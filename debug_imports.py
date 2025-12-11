
import sys
import os

print(f"Python Executable: {sys.executable}")
print(f"Python Path: {sys.path}")

try:
    import google
    print(f"Google module location: {google.__file__}")
except ImportError as e:
    print(f"Failed to import google: {e}")

try:
    import google.auth
    print(f"Google Auth module location: {google.auth.__file__}")
except ImportError as e:
    print(f"Failed to import google.auth: {e}")
