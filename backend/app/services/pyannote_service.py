import torch
import torchaudio
import io
import numpy as np
from typing import List, Tuple
from pyannote.audio import Pipeline
from pyannote.audio.core.task import Specifications, Problem, Resolution
from app.core.config import settings

class PyannoteService:
    def __init__(self):
        self.device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
        print(f"Pyannote using device: {self.device}")
        
        # Dictionary mapping speaker label to a LIST of embedding vectors (Gallery)
        self.known_speakers: dict[str, List[np.ndarray]] = {}
        self.speaker_counter = 0
        self.similarity_threshold = 0.75 # Lenient for real-time stability (matches ~0.68)
        self.merge_threshold = 0.65 # Strict for post-processing merge to avoid false positives
        self.max_gallery_size = 10 # Keep last 10 embeddings per speaker
        
        try:
            auth_token = settings.HF_TOKEN
            if not auth_token:
                raise ValueError("HF_TOKEN not found in settings")
            
            # Allow TorchVersion global for Pyannote model load
            try:
                torch.serialization.add_safe_globals([
                    torch.torch_version.TorchVersion,
                    Specifications,
                    Problem,
                    Resolution
                ])
            except AttributeError:
                pass # Older torch versions don't have this, which is fine
                
            self.pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=auth_token
            )
            self.pipeline.to(self.device)
            print("Pyannote pipeline loaded successfully")
        except Exception as e:
            print(f"Failed to load Pyannote pipeline: {e}")
            raise e

    def _get_speaker_label(self, embedding: np.ndarray) -> str:
        """
        Match embedding to known speakers using Gallery approach (best match in history).
        Returns: Speaker Label (e.g., "Speaker 01")
        """
        best_match = None
        min_dist = float('inf')
        
        # Calculate distance to all known speakers
        for label, gallery in self.known_speakers.items():
            # Find the closest embedding in this speaker's gallery
            # We want the "best fit" to any of their previous voice samples
            speaker_min_dist = float('inf')
            
            for stored_emb in gallery:
                # Cosine distance calculation
                dot = np.dot(embedding, stored_emb)
                norm_a = np.linalg.norm(embedding)
                norm_b = np.linalg.norm(stored_emb)
                similarity = dot / (norm_a * norm_b + 1e-10)
                dist = 1 - similarity
                
                if dist < speaker_min_dist:
                    speaker_min_dist = dist
            
            # If this speaker is the closest so far, track them
            if speaker_min_dist < min_dist:
                min_dist = speaker_min_dist
                best_match = label
        
        print(f"DEBUG: Gallery match. Best: {best_match} | Dist: {min_dist:.4f} | Thresh: {self.similarity_threshold}")

        # Threshold check
        if best_match and min_dist < self.similarity_threshold:
            # Match found! Add this new embedding to their gallery
            self.known_speakers[best_match].append(embedding)
            
            # Keep gallery size manageable
            if len(self.known_speakers[best_match]) > self.max_gallery_size:
                self.known_speakers[best_match].pop(0) # Remove oldest
            
            return best_match
        else:
            # Create new speaker
            self.speaker_counter += 1
            new_label = f"Speaker {self.speaker_counter:02d}"
            # Initialize gallery with this embedding
            self.known_speakers[new_label] = [embedding]
            print(f"DEBUG: New speaker created: {new_label} (Closest was {best_match} at {min_dist:.4f})")
            return new_label

    def diarize_chunk(self, audio_bytes: bytes) -> List[Tuple[float, float, str]]:
        """
        Diarize a chunk of audio bytes (PCM 16kHz).
        Returns list of (start, end, speaker_label).
        """
        try:
            # Convert raw bytes to tensor
            # Assume 16kHz, 16-bit PCM, mono
            audio_tensor = torch.frombuffer(audio_bytes, dtype=torch.int16).float() / 32768.0
            
            # Reshape to (channels, time) -> (1, samples)
            waveform = audio_tensor.unsqueeze(0)
            
            # Diarization requires a file-like object or path, but pyannote can take a waveform 
            # wrapped in a specific dict format if we implement a custom fetcher, 
            # BUT standard way is providing a file path or a dict: {"waveform": ..., "sample_rate": ...}
            
            # Simple wrapper for in-memory processing
            inputs = {
                "waveform": waveform.to(self.device),
                "sample_rate": 16000
            }
            
            # Run pipeline
            output = self.pipeline(inputs, return_embeddings=True)
            
            # Pyannote 3.1+ returns a tuple (diarization, embeddings) when return_embeddings=True
            if isinstance(output, tuple):
                dia, embeddings = output
            else:
                # Fallback for other return types (though tuple is expected)
                dia = getattr(output, 'speaker_diarization', output)
                embeddings = getattr(output, 'speaker_embeddings', None)
            
            segments = []
            
            # Iterate through tracks and match with embeddings
            idx = 0
            for turn, _, _ in dia.itertracks(yield_label=True):
                 # Get embedding for this turn
                 if embeddings is not None and idx < len(embeddings):
                     emb = embeddings[idx]
                     
                     # Check for NaNs (silence/noise)
                     if not np.any(np.isnan(emb)):
                         # Identify speaker using global memory
                         global_speaker = self._get_speaker_label(emb)
                         segments.append((turn.start, turn.end, global_speaker))
                     else:
                         print(f"DEBUG: Skipped segment {turn.start:.2f}-{turn.end:.2f} due to NaN embedding")
                         
                 idx += 1
            
            unique_speakers_in_chunk = set(s[2] for s in segments)
            print(f"DEBUG: Diarization Complete. Found {len(unique_speakers_in_chunk)} speakers in chunk. Total known: {len(self.known_speakers)}")
                
            return segments
            
        except Exception as e:
            print(f"Diarization error: {e}")
            return []

    def merge_speakers(self, diarization, embeddings):
        """
        Post-processing step to merge speakers that are likely the same person
        based on their embedding similarity.
        """
        import numpy as np
        from pyannote.core import Annotation

        if embeddings is None or len(embeddings) == 0:
            return diarization

        # 1. Collect embeddings per speaker
        speaker_embeddings = {}
        idx = 0
        try:
            for turn, _, label in diarization.itertracks(yield_label=True):
                if idx < len(embeddings):
                    emb = embeddings[idx]
                    if not np.any(np.isnan(emb)):
                        if label not in speaker_embeddings:
                            speaker_embeddings[label] = []
                        speaker_embeddings[label].append(emb)
                idx += 1
        except Exception as e:
            print(f"Error collecting embeddings for merge: {e}")
            return diarization

        # 2. Compute Centroids
        centroids = {}
        for speaker, embs in speaker_embeddings.items():
            if embs:
                centroids[speaker] = np.mean(embs, axis=0)
                # Normalize
                norm = np.linalg.norm(centroids[speaker])
                if norm > 0:
                    centroids[speaker] = centroids[speaker] / norm

        # 3. Calculate Distance Matrix and Merge
        # Simple greedy merge: find closest pair < threshold, merge, repeat.
        # Or just use the existing gallery logic?
        # Let's do a pairwise distance check.
        
        mapping = {s: s for s in centroids.keys()}
        speakers = list(centroids.keys())
        
        # We need to iteratively merge.
        # simpler approach: Group speakers.
        
        merged = True
        while merged:
            merged = False
            active_speakers = [s for s in speakers if mapping[s] == s]
            
            best_pair = None
            min_dist = float('inf')
            
            for i in range(len(active_speakers)):
                for j in range(i + 1, len(active_speakers)):
                    spk_a = active_speakers[i]
                    spk_b = active_speakers[j]
                    
                    vec_a = centroids[spk_a]
                    vec_b = centroids[spk_b]
                    
                    # Dist
                    dot = np.dot(vec_a, vec_b)
                    dist = 1.0 - dot # Cosine distance
                    
                    if dist < min_dist:
                        min_dist = dist
                        best_pair = (spk_a, spk_b)
            
            if best_pair and min_dist < self.merge_threshold:
                # Merge pair
                keep, remove = best_pair
                # Mapping: anyone mapped to 'remove' now maps to 'keep'
                # But wait, we should update centroid? 
                # For simplicity, we just map them. Updating centroid might drift.
                # Let's just map 'remove' to 'keep'.
                
                print(f"DEBUG: Merging {remove} into {keep} (Dist: {min_dist:.4f})")
                
                # Update mapping for all original keys
                for orig, current in mapping.items():
                    if current == remove:
                        mapping[orig] = keep
                
                merged = True # Continue checking in case others merge into this one
            
        # 4. Create new Annotation
        new_dia = Annotation()
        for turn, track, label in diarization.itertracks(yield_label=True):
            new_label = mapping.get(label, label)
            new_dia[turn, track] = new_label # Pyannote annotation style
            
        print(f"DEBUG: Merge complete. Reduced speakers from {len(speakers)} to {len(set(mapping.values()))}")
        return new_dia
