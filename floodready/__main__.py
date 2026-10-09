"""Command line: python -m floodready profile | evaluate | report | demo [--scenario severe_11 --trucks 4 --config hubs --map out.png]"""
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
    elif cmd == "demo":
        import argparse
        from .demo import run
        ap = argparse.ArgumentParser(prog="python -m floodready demo")
        ap.add_argument("--scenario", default="severe_11")
        ap.add_argument("--trucks", type=int, default=4)
        ap.add_argument("--config", choices=["single", "hubs"], default="hubs")
        ap.add_argument("--map", default=None, help="write a map PNG to this path")
        a = ap.parse_args(argv[2:])
        run(a.scenario, a.trucks, a.config, a.map)
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv)
