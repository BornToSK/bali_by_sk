"""Entry point for the current remaining-trip generator."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name("remaining.py")),run_name="__main__")
