// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {EvidenceLib} from "../../src/libs/EvidenceLib.sol";
import {VerifiedTx, WindowShape} from "../../src/types/Types.sol";

/// @dev `vm.expectRevert` only observes reverts one call-depth down, and an internal library is
///      inlined into its caller. The harness gives the library an external surface to revert across.
contract EvidenceLibHarness {
    function requireAdjacent(VerifiedTx[] memory w) external pure {
        EvidenceLib.requireAdjacent(w);
    }

    function requireAscendingBeyond(VerifiedTx[] memory w, uint64 h, uint32 i) external pure {
        EvidenceLib.requireAscendingBeyond(w, h, i);
    }

    function enforceShape(VerifiedTx[] memory w, WindowShape shape, uint64 h, uint32 i) external pure {
        EvidenceLib.enforceShape(w, shape, h, i);
    }
}

/// @notice Window discipline: the ordering rules every verdict rests on.
contract EvidenceLibTest is Test {
    EvidenceLibHarness internal lib = new EvidenceLibHarness();

    function _tx(uint64 height, uint32 index) private pure returns (VerifiedTx memory t) {
        t.chainKey = 3;
        t.blockHeight = height;
        t.txIndex = index;
        t.success = true;
    }

    function test_sortsByCoordinate() public pure {
        VerifiedTx[] memory w = new VerifiedTx[](3);
        w[0] = _tx(100, 9);
        w[1] = _tx(99, 4);
        w[2] = _tx(100, 2);

        EvidenceLib.sortByCoordinate(w);

        assertEq(w[0].blockHeight, 99);
        assertEq(w[1].txIndex, 2);
        assertEq(w[2].txIndex, 9);
    }

    /// @dev The batch proof arrives as a map, whose iteration order carries no guarantee. A window
    ///      submitted out of order must still be judged correctly, never rejected.
    function test_adjacencyHoldsAfterShuffle() public view {
        VerifiedTx[] memory w = new VerifiedTx[](3);
        w[0] = _tx(21_340_118, 48);
        w[1] = _tx(21_340_118, 46);
        w[2] = _tx(21_340_118, 47);

        EvidenceLib.sortByCoordinate(w);
        lib.requireAdjacent(w);
    }

    function test_revertsOnGapInBlock() public {
        VerifiedTx[] memory w = new VerifiedTx[](3);
        w[0] = _tx(100, 1);
        w[1] = _tx(100, 2);
        w[2] = _tx(100, 4); // one short of adjacent

        vm.expectRevert(EvidenceLib.WindowNotAdjacent.selector);
        lib.requireAdjacent(w);
    }

    function test_revertsWhenBlockDiffers() public {
        VerifiedTx[] memory w = new VerifiedTx[](2);
        w[0] = _tx(100, 1);
        w[1] = _tx(101, 2);

        vm.expectRevert(EvidenceLib.WindowNotAdjacent.selector);
        lib.requireAdjacent(w);
    }

    function test_streamMustAdvanceBeyondCursor() public {
        VerifiedTx[] memory w = new VerifiedTx[](1);
        w[0] = _tx(100, 5);

        vm.expectRevert(EvidenceLib.CursorRegression.selector);
        lib.requireAscendingBeyond(w, 100, 5); // equal to the cursor is not "beyond"

        lib.requireAscendingBeyond(w, 100, 4);
    }

    function test_streamRejectsDuplicateCoordinates() public {
        VerifiedTx[] memory w = new VerifiedTx[](2);
        w[0] = _tx(100, 5);
        w[1] = _tx(100, 5);

        vm.expectRevert(EvidenceLib.WindowNotAscending.selector);
        lib.requireAscendingBeyond(w, 100, 4);
    }

    function test_enforceShapeSingleTx() public {
        VerifiedTx[] memory w = new VerifiedTx[](2);
        w[0] = _tx(1, 0);
        w[1] = _tx(1, 1);

        vm.expectRevert(abi.encodeWithSelector(EvidenceLib.WindowWrongLength.selector, 1, 2));
        lib.enforceShape(w, WindowShape.SINGLE_TX, 0, 0);
    }

    function testFuzz_sortIsTotalOrder(uint64 h1, uint32 i1, uint64 h2, uint32 i2) public pure {
        VerifiedTx[] memory w = new VerifiedTx[](2);
        w[0] = _tx(h1, i1);
        w[1] = _tx(h2, i2);

        EvidenceLib.sortByCoordinate(w);

        bool ordered = w[0].blockHeight < w[1].blockHeight
            || (w[0].blockHeight == w[1].blockHeight && w[0].txIndex <= w[1].txIndex);
        assertTrue(ordered);
    }
}
