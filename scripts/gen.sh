# bash scripts/gen.sh

set -e

truffle_complie() {
    rm -rf build/
    truffle compile
}

extract_abi_bin() {
  jq .abi build/contracts/$1.json > genfiles/$1.abi
  jq -r .bytecode build/contracts/$1.json > genfiles/$1.bin
}

abigen_files() {
  INPUT_DIR=genfiles

  OUTPUT_DIR=go_bindings
  mkdir -p $OUTPUT_DIR/$2
  abigen -abi $INPUT_DIR/$1.abi -bin $INPUT_DIR/$1.bin -pkg $2 -type $1 -out $OUTPUT_DIR/$2/$2.go
}

sync_go_binding() {
  extract_abi_bin $1
  abigen_files $1 $2
}

cd src
truffle_complie
sync_go_binding HbSwap hbswap
sync_go_binding HbSwapToken hbSwapToken

# truffle-flattener contracts/HbSwap.sol --output contracts/FlattenedHbSwap.sol
# truffle-flattener contracts/HbSwapToken.sol --output contracts/FlattenedHbSwapToken.sol