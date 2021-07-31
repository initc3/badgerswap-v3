# BadgerSwap V3
[IC3 Blockchain Summer Camp Project](https://www.initc3.org/events/2021-07-25-ic3-blockchain-summer-camp)

## Development Environment Setup
We'll use the [fork and pull model](https://docs.github.com/en/github/collaborating-with-pull-requests/getting-started/about-collaborative-development-models#fork-and-pull-model), meaning
that you should first create a fork of the repository, and clone this fork.

1. Fork the project
2. Clone your fork, e.g., if your GitHub username is `alice`:

```console
git clone --recursive git@github.com:alice/badgerswap-v3.git
```

Once you have clone the fork, add the `upstream` remote:

```console
git remote add upstream git@github.com:initc3/badgerswap-v3.git
```

Using `alice` as the username for examples, `git remote --verbose` would show:

```console
git remote --verbose
origin  git@github.com:alice/badgerswap-v3.git (fetch)
origin  git@github.com:alice/badgerswap-v3.git (push)
upstream        git@github.com:initc3/badgerswap-v3.git (fetch)
upstream        git@github.com:initc3/badgerswap-v3.git (push)
```

3. Build the image:

```console
docker-compose -f dev.yml build --no-cache
```

## Running a demo
```console
docker-compose -f dev.yml up -d
```

```console
docker exec -it badgerswap-v3_dev_1 bash
```

```console
./ratel/src/compile.sh
```

```console
./ratel/src/python/badgerswapv3/run.sh
```

```console
python -m ratel.src.python.badgerswapv3.deposit
```

```console
python -m ratel.src.python.badgerswapv3.initPool
```

```console
python -m ratel.src.python.badgerswapv3.addLiquidity
```

```console
python -m ratel.src.python.badgerswapv3.trade
```

## Contributing

### Ideas, questions, etc
Use the [issues](https://github.com/initc3/badgerswap-v3/issues) to document problems,
questions, ideas etc.

Since this is a hackathon, do not hesitate to use the
[issues](https://github.com/initc3/badgerswap-v3/issues) to document any idea, or
question.

Don't censor yourself!

Any idea is welcome!

We have very little time, and we can not afford to risk missing a good idea.
So don't judge your ideas, leave this responsibility to time; time will tell.

View the [issues](https://github.com/initc3/badgerswap-v3/issues) as a place to document
brainstorming ideas!

### Code
To submit code, create a branch, push it to your fork, and make a pull request. Ask
for help if you don't know how.


## Troubleshooting

### Expired TLS/SSL Certificates
See [./testkeys/README.md](./testkeys/README.md).
