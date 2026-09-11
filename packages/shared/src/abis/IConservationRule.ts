// Generated from contracts/out by `pnpm abis`. Do not edit by hand.
export const iConservationRuleAbi = [
  {
    "type": "function",
    "name": "evaluate",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "window",
        "type": "tuple[]",
        "internalType": "struct VerifiedTx[]",
        "components": [
          {
            "name": "chainKey",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "blockHeight",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "txIndex",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "from",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "to",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "success",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "encodedTx",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      },
      {
        "name": "state",
        "type": "tuple",
        "internalType": "struct SubjectView",
        "components": [
          {
            "name": "locked",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "minted",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "price",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "cursorHeight",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "cursorIndex",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "verdict",
        "type": "tuple",
        "internalType": "struct Verdict",
        "components": [
          {
            "name": "violated",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "beneficiary",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "damages",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "evidenceHash",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      },
      {
        "name": "delta",
        "type": "tuple",
        "internalType": "struct AccDelta",
        "components": [
          {
            "name": "lockedDelta",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "mintedDelta",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "price",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "newHeight",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "newIndex",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "ruleId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "settlement",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum Settlement"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "windowShape",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum WindowShape"
      }
    ],
    "stateMutability": "pure"
  }
] as const;
