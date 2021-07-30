#!/usr/bin/env bash

pkill -f python3 || true

python3 -m ratel.src.python.badgerswapv3.run 0 &
python3 -m ratel.src.python.badgerswapv3.run 1 &
python3 -m ratel.src.python.badgerswapv3.run 2 &
python3 -m ratel.src.python.badgerswapv3.run 3 &