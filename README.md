# BadgerSwap V3
[IC3 Blockchain Summer Camp Project](https://www.initc3.org/events/2021-07-25-ic3-blockchain-summer-camp)

## Development Environment Setup
We'll use the [fork and pull model](https://docs.github.com/en/github/collaborating-with-pull-requests/getting-started/about-collaborative-development-models#fork-and-pull-model), meaning
that you should first create a fork of the repository, and clone this fork.

1. Fork the project
2. Clone your fork, e.g., if your GitHub username is `alice`:

```console
git clone git@github.com:alice/badgerswap-v3.git
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

3. Build the image with `docker-compose-dev.yml`:

```console
docker-compose -f docker-compose-dev.yml build
```

## Troubleshooting

### Expired TLS/SSL Certificates
See [./testkeys/README.md](./testkeys/README.md).
