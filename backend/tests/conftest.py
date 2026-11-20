import os
import sys

# Let tests import `services`, `models`, `routers` the same way main.py does.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
