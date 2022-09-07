#!/usr/bin/env sh

cd $(dirname $0)/..

mkdir -p artifacts/deploy

solana program dump GokivDYuQXPZCWRkwMhdH2h91KpDQXBEmpgBgs55bnpH \
    artifacts/deploy/smart_wallet.so --url devnet

solana program dump Govz1VyoyLD5BL6CSCxUJLVLsQHRwjfFj1prNsdNg5Jw \
    artifacts/deploy/govern.so --url devnet

solana program dump metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
    artifacts/deploy/metaplex_token_metadata.so --url devnet
