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
        self.merge_threshold = 0.6 # Strict for post-processing merge to avoid false positives
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
        # Threshold check
        if best_match and min_dist < self.similarity_threshold:
            # Match found! 
            
            # HYGIENE: Only add to gallery if the match is "Very Good" (e.g. < 0.4) 
            # to prevent drift from noisy samples, unless gallery is empty.
            # Normal threshold is 0.75. We want purely clean samples for the profile.
            
            hygiene_threshold = 0.45 
            if min_dist < hygiene_threshold or len(self.known_speakers[best_match]) < 3:
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
                         # HYGIENE: Ignore extremely short segments (< 0.3s) for identification stability
                         if (turn.end - turn.start) < 0.3:
                             continue

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
        Post-processing step to merge speakers using Agglomerative Clustering.
        This provides much better accuracy than greedy merging.
        """
        import numpy as np
        from pyannote.core import Annotation
        from sklearn.cluster import AgglomerativeClustering

        if embeddings is None or len(embeddings) == 0:
            return diarization

        # 1. Collect embeddings and map to segments
        # We need a flat list of embeddings for clustering, but we also need to map them back to labels
        segment_embeddings = []
        segment_labels = []
        segment_turns = []
        
        idx = 0
        try:
            for turn, track, label in diarization.itertracks(yield_label=True):
                if idx < len(embeddings):
                    emb = embeddings[idx]
                    if not np.any(np.isnan(emb)):
                        segment_embeddings.append(emb)
                        segment_labels.append(label)
                        segment_turns.append((turn, track))
                idx += 1
        except Exception as e:
            print(f"Error collecting embeddings for merge: {e}")
            return diarization

        if not segment_embeddings:
            return diarization
            
        X = np.array(segment_embeddings)
        
        # 2. Perform Clustering
        # We use Cosine Distance (metric='cosine')
        # distance_threshold is roughly 1 - similarity. 
        # So 0.65 sim threshold -> 0.35 dist threshold.
        # But AgglomerativeClustering 'distance_threshold' works with linkage.
        # Let's align with our previous logic: 
        # If merge_threshold (sim) is 0.65, then dist is 0.35.
        # However, typically for cosine distance in clustering, a value around 0.4-0.6 works well for separation.
        # We will use "distance_threshold" parameter, meaning clusters are merged if dist < thresh.
        # Lower threshold = stricter merging (more speakers).
        # Higher threshold = looser merging (fewer speakers).
        # Our self.merge_threshold is a *similarity* score (0.65). 
        # So compatible distance is 1.0 - 0.65 = 0.35.
        
        target_dist = 1.0 - self.merge_threshold
        print(f"DEBUG: Clustering with distance_threshold={target_dist:.2f} (Sim={self.merge_threshold})")
        
        # Determine number of clusters automatically using distance_threshold
        # n_clusters=None is required when distance_threshold is set
        clustering = AgglomerativeClustering(
            n_clusters=None,
            metric='cosine',
            linkage='average', # 'average' works well for speaker clustering
            distance_threshold=target_dist
        )
        
        try:
            cluster_labels = clustering.fit_predict(X)
            
            # 3. Create new Annotation
            new_dia = Annotation()
            
            # We map cluster ID -> Speaker ID (e.g., "Cluster 0" -> "Speaker 01")
            # But wait, we want to PRESERVE "User" or specific names if they exist and are dominant in a cluster.
            
            # Analyze clusters
            cluster_map = {} # cluster_id -> final_label
            
            unique_clusters = set(cluster_labels)
            for c_id in unique_clusters:
                # Find all original labels that fell into this cluster
                indices = [i for i, x in enumerate(cluster_labels) if x == c_id]
                original_labels_in_cluster = [segment_labels[i] for i in indices]
                
                # If "User" or any specific name is in this cluster, use that name.
                # Prioritize names that are NOT "Speaker XX"
                
                final_name = f"Speaker {c_id + 1:02d}" # Default new name
                
                # Check for existing meaningful names
                best_name = None
                for name in original_labels_in_cluster:
                    if not name.startswith("Speaker "):
                         best_name = name
                         break # Found a named user, use it
                
                if best_name:
                    final_name = best_name
                else:
                    # If no specific name, check if we can keep one of the existing "Speaker XX" to generate stable colors?
                    # Or just stick to Speaker 01, 02...
                    pass

                cluster_map[c_id] = final_name

            print(f"DEBUG: Merge complete. Found {len(unique_clusters)} unique clusters.")
            
            # Apply new labels
            for i, (turn, track) in enumerate(segment_turns):
                c_id = cluster_labels[i]
                new_label = cluster_map[c_id]
                new_dia[turn, track] = new_label
                
            return new_dia
            
        except Exception as e:
            print(f"Clustering failed: {e}")
            return diarization

    def load_profile(self, user_label: str, embedding: np.ndarray):
        """
        Pre-load a known speaker profile (e.g. the User/Host).
        This ensures they are recognized immediately.
        """
        print(f"DEBUG: Loading profile for {user_label}")
        self.known_speakers[user_label] = [embedding]

    def generate_embedding(self, audio_bytes: bytes) -> np.ndarray:
        """
        Generate a single representative embedding for the audio clip.
        Used for creating a voice profile (Enrollment).
        Assumes the clip contains only ONE speaker (the user).
        Returns: The mean embedding vector (numpy array).
        """
        try:

            import tempfile
            import os
            import subprocess
            
            # Save bytes to temporary file
            # We use .webm as suffix, but if it fails we might try to just write bytes and let ffmpeg detect
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_file:
                temp_file.write(audio_bytes)
                temp_path = temp_file.name
                
            wav_path = temp_path.replace(".webm", ".wav")
            
            try:
                # Use system ffmpeg to convert to 16kHz mono wav
                # This is more robust than torchaudio's internal backend for webm
                subprocess.run([
                    "ffmpeg", 
                    "-y", # Overwrite
                    "-i", temp_path, 
                    "-ac", "1", # Mono
                    "-ar", "16000", # 16kHz
                    wav_path
                ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
                # Load the converted wav file
                waveform, sample_rate = torchaudio.load(wav_path)
                
            except subprocess.CalledProcessError as e:
                print(f"FFmpeg conversion failed: {e}")
                # Fallback: try loading original directly (might fail as before)
                waveform, sample_rate = torchaudio.load(temp_path)
                
                # Resample if needed
                if sample_rate != 16000:
                    resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000)
                    waveform = resampler(waveform)
                if waveform.shape[0] > 1:
                    waveform = torch.mean(waveform, dim=0, keepdim=True)

            finally:
                # Cleanup
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                if os.path.exists(wav_path):
                    os.unlink(wav_path)
            
            inputs = {
                "waveform": waveform.to(self.device),
                "sample_rate": 16000
            }
            
            # Run pipeline
            output = self.pipeline(inputs, return_embeddings=True)
            
            if isinstance(output, tuple):
                _, embeddings = output
            else:
                 embeddings = getattr(output, 'speaker_embeddings', None)
            
            if embeddings is None or len(embeddings) == 0:
                print("No embeddings found in enrollment audio.")
                return None
            
            # Filter NaNs
            valid_embeddings = [e for e in embeddings if not np.any(np.isnan(e))]
            
            if not valid_embeddings:
                print("Only NaN embeddings found.")
                return None
                
            # Calculate Mean Embedding (Centroid)
            mean_embedding = np.mean(valid_embeddings, axis=0)
            
            # Normalize
            norm = np.linalg.norm(mean_embedding)
            if norm > 0:
                mean_embedding = mean_embedding / norm
                
            return mean_embedding

        except Exception as e:
            print(f"Error generating embedding: {e}")
            raise e
            
# Singleton instance
try:
    pyannote_instance = PyannoteService()
except Exception as e:
    print(f"Warning: Could not initialize PyannoteService singleton: {e}")
    pyannote_instance = None
