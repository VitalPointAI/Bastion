"""Configure sys.path so pytest can import bridge.* from within the bridge/ directory."""
import sys
import os

# Add the project root (parent of bridge/) to sys.path so that
# "import bridge.command_queue" resolves correctly.
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)
