"""pytest configuration for the robot/ test suite.

Ensures the project root is on sys.path so that ``import robot`` resolves
correctly when tests are run from within the robot/ directory.
"""
import sys
import os

# Add the project root (parent of robot/) to sys.path
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)
