if [ "$1" != "--skip-build" ]
then
    anchor build --skip-lint

    # Build tests
    yarn install && yarn build
fi

anchor test --skip-build --provider.cluster localnet
