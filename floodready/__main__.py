"""Command line: python -m floodready evaluate | profile | demo"""
import sys


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "help"
    if cmd == "evaluate":
        from .evaluate import main as run
        run()
    elif cmd == "profile":
        from .profile import main as run
        run()
    elif cmd == "report":
        from .report import main as run
        run()
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv)
