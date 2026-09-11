// Generated from contracts/out by `pnpm abis`. Do not edit by hand.
export const subjectRegistryAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "owner_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "allSubjects",
    "inputs": [],
    "outputs": [
      {
        "name": "ids",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      },
      {
        "name": "items",
        "type": "tuple[]",
        "internalType": "struct Subject[]",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum SubjectKind"
          },
          {
            "name": "chainKey",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "sourceContract",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "boundRule",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "anchorHeight",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "anchorIndex",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "payoutCapPerBlock",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "priceSubject",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "active",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "label",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "exists",
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
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSubject",
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
        "internalType": "struct Subject",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum SubjectKind"
          },
          {
            "name": "chainKey",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "sourceContract",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "boundRule",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "anchorHeight",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "anchorIndex",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "payoutCapPerBlock",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "priceSubject",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "active",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "label",
            "type": "string",
            "internalType": "string"
          }
        ]
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
    "name": "payoutCap",
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
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registerRule",
    "inputs": [
      {
        "name": "ruleId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "impl",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "allowed",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "registerSubject",
    "inputs": [
      {
        "name": "kind",
        "type": "uint8",
        "internalType": "enum SubjectKind"
      },
      {
        "name": "chainKey",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "sourceContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "ruleId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "anchorHeight",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "anchorIndex",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "payoutCapPerBlock",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "label",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
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
    "name": "ruleAllowed",
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
    "name": "ruleImpl",
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
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setPayoutCap",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "cap",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setPriceSubject",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "priceSubjectId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setSubjectActive",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "active",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "subjectAt",
    "inputs": [
      {
        "name": "i",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
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
    "name": "subjectCount",
    "inputs": [],
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
    "name": "PayoutCapSet",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "cap",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PriceSubjectSet",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "priceSubject",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RuleRegistered",
    "inputs": [
      {
        "name": "ruleId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "impl",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "allowed",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SubjectPaused",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "active",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SubjectRegistered",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "chainKey",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "sourceContract",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "ruleId",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "label",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
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
    "name": "SubjectExists",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "UnknownRule",
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
    "name": "UnknownSubject",
    "inputs": [
      {
        "name": "subjectId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  }
] as const;
