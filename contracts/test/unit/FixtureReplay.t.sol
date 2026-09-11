// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {console2} from "forge-std/console2.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {INativeQueryVerifier} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

import {Base} from "../Base.t.sol";

/// @notice Replays proof bundles captured from the live CC3 Testnet against the on-chain code.
///
/// @dev This is the Day-1 assertion, committed as a test rather than left in a script's output.
///      `pnpm capture <txHash>...` writes a bundle to `fixtures/`; this suite then asserts, for every
///      bundle present:
///
///        1. the index derived from the REAL Merkle sibling path equals the index the Proof Builder
///           reported for that transaction - the three-way equality of the thesis, minus Etherscan,
///           which the capture script already checked off-chain;
///        2. `EvmV1Decoder` decodes the REAL `encodedTransaction` bytes - real receipts, real logs -
///           rather than only the shapes `TxFixture` builds.
///
///      Every other suite uses synthesised transactions, which proves the logic and not the decoding.
///      This one proves the decoding. It is skipped, loudly, when no fixture has been captured, so a
///      fresh clone with no API keys still runs the full offline suite green.
contract FixtureReplayTest is Base {
    string internal constant DIR = "../fixtures";

    function test_capturedBundlesDecodeAndIndexCorrectly() public {
        string[] memory files = _fixtureFiles();
        if (files.length == 0) {
            console2.log("no fixtures in ../fixtures - skipping replay");
            console2.log("capture one with:  pnpm capture 0x<txHash> [0x<txHash> ...]");
            return;
        }

        for (uint256 f; f < files.length; ++f) {
            _replay(files[f]);
        }
    }

    /// @dev Collected per bundle so a three-row window can be checked for the shape the whole project
    ///      rests on, using nothing but coordinates the precompile derived from real Merkle paths.
    struct Row {
        uint64 height;
        uint32 index;
        address from;
    }

    function _replay(string memory path) private {
        string memory json = vm.readFile(path);
        console2.log("replaying", path);

        // Read row by row rather than with a `[*]` wildcard: Foundry collapses a one-element wildcard
        // result to a scalar, so a single-transaction bundle would fail to parse as an array.
        uint256 rowCount = vm.parseJsonUint(json, "$.rowCount");
        assertGt(rowCount, 0, "fixture has no rows");

        Row[] memory rows = new Row[](rowCount);

        for (uint256 i; i < rowCount; ++i) {
            string memory row = string.concat("$.rows[", vm.toString(i), "]");

            uint256 height = vm.parseJsonUint(json, string.concat(row, ".blockHeight"));
            uint256 reportedIndex = vm.parseJsonUint(json, string.concat(row, ".txIndex"));
            bytes32 root = vm.parseJsonBytes32(json, string.concat(row, ".merkleRoot"));
            bytes memory txBytes = vm.parseJsonBytes(json, string.concat(row, ".txBytes"));

            INativeQueryVerifier.MerkleProof memory proof =
                INativeQueryVerifier.MerkleProof({root: root, siblings: _siblings(json, i)});

            // (1) The coordinate, derived from the real sibling path by the same arithmetic the live
            //     precompile uses (asserted against 0x0FD2 itself by `pnpm verify:precompile`).
            uint64 derived = INativeQueryVerifier(PRECOMPILE).calculateTxIndex(proof);
            assertEq(
                uint256(derived),
                reportedIndex,
                "derived txIndex disagrees with the Proof Builder's - the thesis does not hold"
            );

            // (2) The real transaction bytes, through the real decoder.
            EvmV1Decoder.CommonTxFields memory common = EvmV1Decoder.decodeCommonTxFields(txBytes);
            EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(txBytes);

            assertTrue(common.from != address(0), "decoded sender is empty");
            assertLe(receipt.receiptStatus, 1, "receipt status is not a boolean");

            rows[i] = Row({height: uint64(height), index: uint32(derived), from: common.from});

            console2.log("  block", height, "index", derived);
            console2.log("  from", common.from);
            console2.log("  status", receipt.receiptStatus, "logs", receipt.receiptLogs.length);
        }

        if (rowCount == 3) _assertBracketed(rows);
    }

    /// @notice The thesis, stated as an assertion over real data.
    ///
    /// @dev Three transactions, one block, strictly consecutive positions, the same sender on both
    ///      outer positions and somebody else in the middle. Every coordinate here came from the
    ///      precompile reading a real Merkle sibling path, and every address from decoding real
    ///      transaction bytes. This is precisely the fact an Ethereum contract cannot establish about
    ///      its own neighbours - and the reason Watchtower settles on Creditcoin.
    function _assertBracketed(Row[] memory rows) private pure {
        assertEq(rows[1].height, rows[0].height, "window is not one block");
        assertEq(rows[2].height, rows[0].height, "window is not one block");
        assertEq(uint256(rows[1].index), uint256(rows[0].index) + 1, "indices are not consecutive");
        assertEq(uint256(rows[2].index), uint256(rows[1].index) + 1, "indices are not consecutive");
        assertEq(rows[2].from, rows[0].from, "the brackets are not the same sender");
        assertTrue(rows[1].from != rows[0].from, "the victim is the searcher");
    }

    function _siblings(string memory json, uint256 row)
        private
        view
        returns (INativeQueryVerifier.MerkleProofEntry[] memory entries)
    {
        // Read the flat columns the capture script writes alongside the nested `siblings`: a `[*]`
        // projection across an array of objects is not a single JSON value, and Foundry's array
        // cheatcodes reject it.
        string memory base = string.concat("$.rows[", vm.toString(row), "]");
        bytes32[] memory hashes = vm.parseJsonBytes32Array(json, string.concat(base, ".siblingHashes"));
        bool[] memory isLeft = vm.parseJsonBoolArray(json, string.concat(base, ".siblingIsLeft"));
        require(hashes.length == isLeft.length, "malformed fixture: sibling fields disagree");

        entries = new INativeQueryVerifier.MerkleProofEntry[](hashes.length);
        for (uint256 i; i < hashes.length; ++i) {
            entries[i] = INativeQueryVerifier.MerkleProofEntry({hash: hashes[i], isLeft: isLeft[i]});
        }
    }

    /// @dev `fixtures/` is committed but may legitimately be empty - proof capture needs a funded
    ///      RPC key and a live testnet, neither of which a CI clone has.
    function _fixtureFiles() private returns (string[] memory out) {
        try vm.readDir(DIR) returns (VmSafe.DirEntry[] memory entries) {
            uint256 n;
            string[] memory found = new string[](entries.length);
            for (uint256 i; i < entries.length; ++i) {
                if (_endsWithJson(entries[i].path)) found[n++] = entries[i].path;
            }
            out = new string[](n);
            for (uint256 i; i < n; ++i) out[i] = found[i];
        } catch {
            out = new string[](0);
        }
    }

    function _endsWithJson(string memory path) private pure returns (bool) {
        bytes memory b = bytes(path);
        if (b.length < 5) return false;
        return b[b.length - 5] == "." && b[b.length - 4] == "j" && b[b.length - 3] == "s"
            && b[b.length - 2] == "o" && b[b.length - 1] == "n";
    }
}
