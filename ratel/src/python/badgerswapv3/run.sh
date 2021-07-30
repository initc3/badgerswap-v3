#!/usr/bin/env bash

bash chain-latest.sh &
sleep 3

pkill -f python3 || true

rm -rf /opt/hbswap/db/*
python3 -m ratel.src.python.deploy badgerswapv3

python3 -m ratel.src.python.badgerswapv3.run 0 &
python3 -m ratel.src.python.badgerswapv3.run 1 &
python3 -m ratel.src.python.badgerswapv3.run 2 &
python3 -m ratel.src.python.badgerswapv3.run 3 &

# bash ratel/src/python/badgerswapv3/run.sh
# python3 -m ratel.src.python.badgerswapv3.deposit
# python3 -m ratel.src.python.badgerswapv3.initPool
# python3 -m ratel.src.python.badgerswapv3.addLiquidity
# python3 -m ratel.src.python.badgerswapv3.trade