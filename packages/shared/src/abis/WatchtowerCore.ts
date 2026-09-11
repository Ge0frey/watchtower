// Generated from contracts/out by `pnpm abis`. Do not edit by hand.
export const watchtowerCoreAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "owner_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "registry_",
        "type": "address",
        "internalType": "contract SubjectRegistry"
      },
      {
        "name": "vault_",
        "type": "address",
        "internalType": "contract IUnderwritingVault"
      },
      {
        "name": "challengeWindow_",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "receive",
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "GAP_RULE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "REGISTRY",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract SubjectRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "VAULT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IUnderwritingVault"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "VERIFIER",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract INativeQueryVerifier"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "challengeGap",
    "inputs": [
      {
        "name": "incidentId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "gapEvidence",
        "type": "tuple",
        "internalType": "struct EvidenceInput",
        "components": [
          {
            "name": "subjectId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "ruleId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "chainKey",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "blockHeights",
            "type": "uint64[]",
            "internalType": "uint64[]"
          },
          {
            "name": "encodedTxs",
            "type": "bytes[]",
            "internalType": "bytes[]"
          },
          {
            "name": "merkleRoots",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          },
          {
            "name": "siblings",
            "type": "tuple[][]",
            "internalType": "struct INativeQueryVerifier.MerkleProofEntry[][]",
            "components": [
              {
                "name": "hash",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "isLeft",
                "type": "bool",
                "internalType": "bool"
              }
            ]
          },
          {
            "name": "lowerEndpointDigest",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "continuityRoots",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "challengeWindow",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "consumed",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "incidentOf",
    "inputs": [
      {
        "name": "incidentId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct Incident",
        "components": [
          {
            "name": "subjectId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "ruleId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "prosecutor",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "beneficiary",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "damagesUsd",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "fromHeight",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "fromIndex",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "toHeight",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "toIndex",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "challengeDeadline",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "continuityLength",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "snapshot",
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
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "uint8"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "incidents",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "ruleId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "prosecutor",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "beneficiary",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "damagesUsd",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "fromHeight",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "fromIndex",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "toHeight",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "toIndex",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "challengeDeadline",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "continuityLength",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "snapshot",
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
      },
      {
        "name": "status",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "latestProvenHead",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "height",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "index",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "openBreaches",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "previewEvidence",
    "inputs": [
      {
        "name": "input",
        "type": "tuple",
        "internalType": "struct EvidenceInput",
        "components": [
          {
            "name": "subjectId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "ruleId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "chainKey",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "blockHeights",
            "type": "uint64[]",
            "internalType": "uint64[]"
          },
          {
            "name": "encodedTxs",
            "type": "bytes[]",
            "internalType": "bytes[]"
          },
          {
            "name": "merkleRoots",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          },
          {
            "name": "siblings",
            "type": "tuple[][]",
            "internalType": "struct INativeQueryVerifier.MerkleProofEntry[][]",
            "components": [
              {
                "name": "hash",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "isLeft",
                "type": "bool",
                "internalType": "bool"
              }
            ]
          },
          {
            "name": "lowerEndpointDigest",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "continuityRoots",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "verified",
        "type": "bool",
        "internalType": "bool"
      },
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
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "price",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "answer",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "provenAtHeight",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "reserves",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "locked",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "minted",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setChallengeWindow",
    "inputs": [
      {
        "name": "window",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "settleBreach",
    "inputs": [
      {
        "name": "incidentId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "stateOf",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
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
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "submitEvidence",
    "inputs": [
      {
        "name": "input",
        "type": "tuple",
        "internalType": "struct EvidenceInput",
        "components": [
          {
            "name": "subjectId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "ruleId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "chainKey",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "blockHeights",
            "type": "uint64[]",
            "internalType": "uint64[]"
          },
          {
            "name": "encodedTxs",
            "type": "bytes[]",
            "internalType": "bytes[]"
          },
          {
            "name": "merkleRoots",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          },
          {
            "name": "siblings",
            "type": "tuple[][]",
            "internalType": "struct INativeQueryVerifier.MerkleProofEntry[][]",
            "components": [
              {
                "name": "hash",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "isLeft",
                "type": "bool",
                "internalType": "bool"
              }
            ]
          },
          {
            "name": "lowerEndpointDigest",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "continuityRoots",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "incidentId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "BreachOpened",
    "inputs": [
      {
        "name": "incidentId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "subjectId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "damagesUsd",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "prosecutor",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "bond",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "challengeDeadline",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BreachSettled",
    "inputs": [
      {
        "name": "incidentId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "paid",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CursorAdvanced",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "height",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "index",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EvidenceAccepted",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "ruleId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "incidentId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "chainKey",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "blockHeight",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "txIndex",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "continuityLength",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "GapChallengeUpheld",
    "inputs": [
      {
        "name": "incidentId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "challenger",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "gapHeight",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "gapIndex",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PriceUpdated",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "answer",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "provenAtHeight",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VerdictIssued",
    "inputs": [
      {
        "name": "incidentId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "subjectId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "ruleId",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "beneficiary",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "damagesUsd",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "paid",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "evidenceHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyConsumed",
    "inputs": [
      {
        "name": "key",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "BondTooSmall",
    "inputs": [
      {
        "name": "required",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ChainKeyMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ChallengeWindowClosed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ChallengeWindowOpen",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CursorRegression",
    "inputs": []
  },
  {
    "type": "error",
    "name": "GapNotInRange",
    "inputs": []
  },
  {
    "type": "error",
    "name": "GapNotRelevant",
    "inputs": []
  },
  {
    "type": "error",
    "name": "IncidentNotOpen",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MalformedInput",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ReceiptNotSuccessful",
    "inputs": [
      {
        "name": "position",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "RefundFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RuleMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RuleNotAllowed",
    "inputs": [
      {
        "name": "ruleId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "SubjectInactive",
    "inputs": []
  },
  {
    "type": "error",
    "name": "VerificationFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "WindowEmpty",
    "inputs": []
  },
  {
    "type": "error",
    "name": "WindowNotAdjacent",
    "inputs": []
  },
  {
    "type": "error",
    "name": "WindowNotAscending",
    "inputs": []
  },
  {
    "type": "error",
    "name": "WindowWrongLength",
    "inputs": [
      {
        "name": "expected",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "actual",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  }
] as const;
