import os
import sys

# Make `import app` work when running pytest without an editable install.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
