/**
 * ChessEngine — Complete chess rules engine
 * Pure game logic: no rendering, no DOM, no AI.
 * 
 * Board layout: board[row][col]
 *   board[0][0] = a8, board[0][7] = h8
 *   board[7][0] = a1, board[7][7] = h1
 * 
 * Pieces: { type: 'pawn'|'rook'|'knight'|'bishop'|'queen'|'king', color: 'white'|'black' }
 */
class ChessEngine {
  constructor() {
    this.board = this.createInitialBoard();
    this.turn = 'white';
    this.moveHistory = [];
    this.capturedPieces = { white: [], black: [] };
    this.gameState = 'playing'; // 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw'
    this.enPassantTarget = null; // { row, col } or null
    this.castlingRights = {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true }
    };
    this.halfMoveClock = 0;
    this.fullMoveNumber = 1;
  }

  // ── Board Setup ──────────────────────────────────────────────────────

  createInitialBoard() {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    const backRank = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

    for (let col = 0; col < 8; col++) {
      board[0][col] = { type: backRank[col], color: 'black' };
      board[1][col] = { type: 'pawn', color: 'black' };
      board[6][col] = { type: 'pawn', color: 'white' };
      board[7][col] = { type: backRank[col], color: 'white' };
    }
    return board;
  }

  reset() {
    this.board = this.createInitialBoard();
    this.turn = 'white';
    this.moveHistory = [];
    this.capturedPieces = { white: [], black: [] };
    this.gameState = 'playing';
    this.enPassantTarget = null;
    this.castlingRights = {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true }
    };
    this.halfMoveClock = 0;
    this.fullMoveNumber = 1;
  }

  // ── Accessors ────────────────────────────────────────────────────────

  getPieceAt(row, col) {
    if (!this._inBounds(row, col)) return null;
    return this.board[row][col];
  }

  getState() {
    return {
      board: this.board.map(r => r.map(c => c ? { ...c } : null)),
      turn: this.turn,
      moveHistory: this.moveHistory.map(m => ({ ...m })),
      capturedPieces: {
        white: this.capturedPieces.white.map(p => ({ ...p })),
        black: this.capturedPieces.black.map(p => ({ ...p }))
      },
      gameState: this.gameState,
      enPassantTarget: this.enPassantTarget ? { ...this.enPassantTarget } : null,
      castlingRights: {
        white: { ...this.castlingRights.white },
        black: { ...this.castlingRights.black }
      },
      halfMoveClock: this.halfMoveClock,
      fullMoveNumber: this.fullMoveNumber
    };
  }

  // ── Move Generation ──────────────────────────────────────────────────

  /**
   * Returns all legal moves for the piece at (row, col).
   * Filters out moves that would leave own king in check.
   */
  getValidMoves(row, col) {
    const piece = this.getPieceAt(row, col);
    if (!piece) return [];
    const pseudoMoves = this._getPseudoLegalMoves(row, col, piece);
    return pseudoMoves.filter(m => !this._moveLeavesKingInCheck(row, col, m.row, m.col, piece.color));
  }

  /**
   * Returns all valid moves for a color: array of { from: {row,col}, to: {row,col} }
   */
  getAllValidMoves(color) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && piece.color === color) {
          const valid = this.getValidMoves(r, c);
          for (const to of valid) {
            moves.push({ from: { row: r, col: c }, to });
          }
        }
      }
    }
    return moves;
  }

  // ── Move Execution ───────────────────────────────────────────────────

  /**
   * Execute a move. Returns a result object.
   * promotion: 'queen'|'rook'|'bishop'|'knight' (default 'queen')
   */
  makeMove(fromRow, fromCol, toRow, toCol, promotion) {
    const piece = this.getPieceAt(fromRow, fromCol);
    if (!piece || piece.color !== this.turn) {
      return { valid: false };
    }

    const validMoves = this.getValidMoves(fromRow, fromCol);
    const isValid = validMoves.some(m => m.row === toRow && m.col === toCol);
    if (!isValid) {
      return { valid: false };
    }

    const captured = this.board[toRow][toCol];
    let castling = null;
    let enPassant = false;
    let promotionType = null;
    const opponent = piece.color === 'white' ? 'black' : 'white';

    // Generate algebraic notation BEFORE modifying the board
    const notation = this._generateAlgebraic(fromRow, fromCol, toRow, toCol, piece, captured, promotion);

    // ── En passant capture ──
    if (piece.type === 'pawn' && this.enPassantTarget &&
        toRow === this.enPassantTarget.row && toCol === this.enPassantTarget.col) {
      enPassant = true;
      const capturedPawnRow = piece.color === 'white' ? toRow + 1 : toRow - 1;
      const capturedPawn = this.board[capturedPawnRow][toCol];
      if (capturedPawn) {
        this.capturedPieces[piece.color].push(capturedPawn);
      }
      this.board[capturedPawnRow][toCol] = null;
    }

    // ── Castling ──
    if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
      if (toCol > fromCol) {
        castling = 'kingside';
        this.board[fromRow][5] = this.board[fromRow][7];
        this.board[fromRow][7] = null;
      } else {
        castling = 'queenside';
        this.board[fromRow][3] = this.board[fromRow][0];
        this.board[fromRow][0] = null;
      }
    }

    // ── Update captured pieces ──
    if (captured && !enPassant) {
      this.capturedPieces[piece.color].push(captured);
    }

    // ── Move the piece ──
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

    // ── Pawn promotion ──
    if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
      promotionType = promotion || 'queen';
      this.board[toRow][toCol] = { type: promotionType, color: piece.color };
    }

    // ── Update en passant target ──
    if (piece.type === 'pawn' && Math.abs(toRow - fromRow) === 2) {
      this.enPassantTarget = {
        row: (fromRow + toRow) / 2,
        col: fromCol
      };
    } else {
      this.enPassantTarget = null;
    }

    // ── Update castling rights ──
    if (piece.type === 'king') {
      this.castlingRights[piece.color].kingSide = false;
      this.castlingRights[piece.color].queenSide = false;
    }
    if (piece.type === 'rook') {
      if (fromCol === 0) this.castlingRights[piece.color].queenSide = false;
      if (fromCol === 7) this.castlingRights[piece.color].kingSide = false;
    }
    // If a rook is captured on its home square, revoke that side's castling
    if (captured && captured.type === 'rook') {
      if (toRow === 0 && toCol === 0) this.castlingRights.black.queenSide = false;
      if (toRow === 0 && toCol === 7) this.castlingRights.black.kingSide = false;
      if (toRow === 7 && toCol === 0) this.castlingRights.white.queenSide = false;
      if (toRow === 7 && toCol === 7) this.castlingRights.white.kingSide = false;
    }

    // ── Half-move clock (50-move rule) ──
    if (piece.type === 'pawn' || captured || enPassant) {
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }

    // ── Full move number ──
    if (piece.color === 'black') {
      this.fullMoveNumber++;
    }

    // ── Check / checkmate / stalemate detection ──
    const check = this.isCheck(opponent);
    const checkmate = check && this.isCheckmate(opponent);
    const stalemate = !check && this.isStalemate(opponent);
    const isDraw = this.halfMoveClock >= 100;

    // ── Update game state ──
    if (checkmate) {
      this.gameState = 'checkmate';
    } else if (stalemate) {
      this.gameState = 'stalemate';
    } else if (isDraw) {
      this.gameState = 'draw';
    } else if (check) {
      this.gameState = 'check';
    } else {
      this.gameState = 'playing';
    }

    // ── Append check/mate suffix to notation ──
    let finalNotation = notation;
    if (checkmate) {
      finalNotation += '#';
    } else if (check) {
      finalNotation += '+';
    }

    // ── Record move ──
    const moveRecord = {
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      piece: { type: piece.type, color: piece.color },
      captured: captured ? { ...captured } : (enPassant ? { type: 'pawn', color: opponent } : null),
      castling,
      enPassant,
      promotion: promotionType,
      notation: finalNotation
    };
    this.moveHistory.push(moveRecord);

    // ── Switch turn ──
    this.turn = opponent;

    return {
      valid: true,
      captured: moveRecord.captured,
      check,
      checkmate,
      stalemate,
      castling,
      enPassant,
      promotion: promotionType,
      notation: finalNotation
    };
  }

  // ── Check / Checkmate / Stalemate ────────────────────────────────────

  /** Is the given color's king currently in check? */
  isCheck(color) {
    const kingPos = this._findKing(color);
    if (!kingPos) return false;
    return this._isSquareAttacked(kingPos.row, kingPos.col, color === 'white' ? 'black' : 'white');
  }

  /** Is it checkmate for the given color? (in check + no legal moves) */
  isCheckmate(color) {
    if (!this.isCheck(color)) return false;
    return this.getAllValidMoves(color).length === 0;
  }

  /** Is it stalemate for the given color? (not in check + no legal moves) */
  isStalemate(color) {
    if (this.isCheck(color)) return false;
    return this.getAllValidMoves(color).length === 0;
  }

  // ── FEN Conversion ───────────────────────────────────────────────────

  toFEN() {
    const pieceToFen = { pawn: 'p', rook: 'r', knight: 'n', bishop: 'b', queen: 'q', king: 'k' };
    let fen = '';

    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p) {
          empty++;
        } else {
          if (empty > 0) { fen += empty; empty = 0; }
          const ch = pieceToFen[p.type];
          fen += p.color === 'white' ? ch.toUpperCase() : ch;
        }
      }
      if (empty > 0) fen += empty;
      if (r < 7) fen += '/';
    }

    fen += ' ' + (this.turn === 'white' ? 'w' : 'b');

    let castling = '';
    if (this.castlingRights.white.kingSide) castling += 'K';
    if (this.castlingRights.white.queenSide) castling += 'Q';
    if (this.castlingRights.black.kingSide) castling += 'k';
    if (this.castlingRights.black.queenSide) castling += 'q';
    fen += ' ' + (castling || '-');

    if (this.enPassantTarget) {
      fen += ' ' + this._toAlgebraicSquare(this.enPassantTarget.row, this.enPassantTarget.col);
    } else {
      fen += ' -';
    }

    fen += ' ' + this.halfMoveClock;
    fen += ' ' + this.fullMoveNumber;

    return fen;
  }

  fromFEN(fen) {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 4) throw new Error('Invalid FEN: not enough fields');

    const fenToType = { p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', q: 'queen', k: 'king' };

    const rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('Invalid FEN: board must have 8 ranks');

    this.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let r = 0; r < 8; r++) {
      let col = 0;
      for (const ch of rows[r]) {
        if (ch >= '1' && ch <= '8') {
          col += parseInt(ch);
        } else {
          const color = ch === ch.toUpperCase() ? 'white' : 'black';
          const type = fenToType[ch.toLowerCase()];
          if (!type) throw new Error('Invalid FEN piece: ' + ch);
          this.board[r][col] = { type, color };
          col++;
        }
      }
    }

    this.turn = parts[1] === 'b' ? 'black' : 'white';

    this.castlingRights = {
      white: { kingSide: false, queenSide: false },
      black: { kingSide: false, queenSide: false }
    };
    const castlingStr = parts[2];
    if (castlingStr !== '-') {
      if (castlingStr.includes('K')) this.castlingRights.white.kingSide = true;
      if (castlingStr.includes('Q')) this.castlingRights.white.queenSide = true;
      if (castlingStr.includes('k')) this.castlingRights.black.kingSide = true;
      if (castlingStr.includes('q')) this.castlingRights.black.queenSide = true;
    }

    if (parts[3] && parts[3] !== '-') {
      this.enPassantTarget = this._fromAlgebraicSquare(parts[3]);
    } else {
      this.enPassantTarget = null;
    }

    this.halfMoveClock = parts[4] ? parseInt(parts[4]) : 0;
    this.fullMoveNumber = parts[5] ? parseInt(parts[5]) : 1;

    // Reset transient state
    this.moveHistory = [];
    this.capturedPieces = { white: [], black: [] };
    this.gameState = 'playing';

    // Re-evaluate game state
    const currentColor = this.turn;
    if (this.isCheckmate(currentColor)) {
      this.gameState = 'checkmate';
    } else if (this.isStalemate(currentColor)) {
      this.gameState = 'stalemate';
    } else if (this.isCheck(currentColor)) {
      this.gameState = 'check';
    }
  }

  // ── Algebraic Notation ───────────────────────────────────────────────

  /**
   * Parse algebraic notation to { fromRow, fromCol, toRow, toCol, promotion }.
   * Requires color to resolve pawn direction and find candidate pieces.
   */
  parseAlgebraic(notation, color) {
    let n = notation.replace(/[+#!?]/g, '').trim();

    // Castling
    if (n === 'O-O' || n === '0-0') {
      const row = color === 'white' ? 7 : 0;
      return { fromRow: row, fromCol: 4, toRow: row, toCol: 6 };
    }
    if (n === 'O-O-O' || n === '0-0-0') {
      const row = color === 'white' ? 7 : 0;
      return { fromRow: row, fromCol: 4, toRow: row, toCol: 2 };
    }

    // Promotion
    let promoResult = null;
    const promoMatch = n.match(/=([QRBN])/i);
    if (promoMatch) {
      const promoMap = { Q: 'queen', R: 'rook', B: 'bishop', N: 'knight' };
      promoResult = promoMap[promoMatch[1].toUpperCase()];
      n = n.replace(/=[QRBN]/i, '');
    }

    // Strip capture marker
    n = n.replace('x', '');

    const pieceMap = { N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king' };
    let pieceType = 'pawn';
    let disambigFile = null;
    let disambigRank = null;

    if (n.length > 0 && 'NBRQK'.includes(n[0])) {
      pieceType = pieceMap[n[0]];
      n = n.substring(1);
    }

    if (n.length < 2) return null;
    const destFile = n.charCodeAt(n.length - 2) - 97;
    const destRank = 8 - parseInt(n[n.length - 1]);
    const toRow = destRank;
    const toCol = destFile;

    const disambig = n.substring(0, n.length - 2);
    for (const ch of disambig) {
      if (ch >= 'a' && ch <= 'h') {
        disambigFile = ch.charCodeAt(0) - 97;
      } else if (ch >= '1' && ch <= '8') {
        disambigRank = 8 - parseInt(ch);
      }
    }

    // Find the piece that can legally make this move
    const candidates = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p || p.type !== pieceType || p.color !== color) continue;
        if (disambigFile !== null && c !== disambigFile) continue;
        if (disambigRank !== null && r !== disambigRank) continue;
        const moves = this.getValidMoves(r, c);
        if (moves.some(m => m.row === toRow && m.col === toCol)) {
          candidates.push({ row: r, col: c });
        }
      }
    }

    if (candidates.length === 0) return null;
    const from = candidates[0];
    return { fromRow: from.row, fromCol: from.col, toRow, toCol, promotion: promoResult };
  }

  /**
   * Convert a move to algebraic notation (before executing it).
   */
  toAlgebraic(fromRow, fromCol, toRow, toCol) {
    const piece = this.getPieceAt(fromRow, fromCol);
    if (!piece) return '';
    return this._generateAlgebraic(fromRow, fromCol, toRow, toCol, piece, this.getPieceAt(toRow, toCol), null);
  }

  // ── Internal: Pseudo-Legal Move Generation ───────────────────────────

  _getPseudoLegalMoves(row, col, piece) {
    switch (piece.type) {
      case 'pawn':   return this._pawnMoves(row, col, piece.color);
      case 'rook':   return this._slidingMoves(row, col, piece.color, [[0,1],[0,-1],[1,0],[-1,0]]);
      case 'bishop': return this._slidingMoves(row, col, piece.color, [[1,1],[1,-1],[-1,1],[-1,-1]]);
      case 'queen':  return this._slidingMoves(row, col, piece.color, [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]);
      case 'knight': return this._knightMoves(row, col, piece.color);
      case 'king':   return this._kingMoves(row, col, piece.color);
      default:       return [];
    }
  }

  _pawnMoves(row, col, color) {
    const moves = [];
    const dir = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;

    // Forward one
    if (this._inBounds(row + dir, col) && !this.board[row + dir][col]) {
      moves.push({ row: row + dir, col });
      // Forward two from start
      if (row === startRow && !this.board[row + 2 * dir][col]) {
        moves.push({ row: row + 2 * dir, col });
      }
    }

    // Diagonal captures
    for (const dc of [-1, 1]) {
      const nr = row + dir;
      const nc = col + dc;
      if (!this._inBounds(nr, nc)) continue;
      const target = this.board[nr][nc];
      if (target && target.color !== color) {
        moves.push({ row: nr, col: nc });
      }
      // En passant
      if (this.enPassantTarget && this.enPassantTarget.row === nr && this.enPassantTarget.col === nc) {
        moves.push({ row: nr, col: nc });
      }
    }

    return moves;
  }

  _slidingMoves(row, col, color, directions) {
    const moves = [];
    for (const [dr, dc] of directions) {
      let r = row + dr, c = col + dc;
      while (this._inBounds(r, c)) {
        const target = this.board[r][c];
        if (!target) {
          moves.push({ row: r, col: c });
        } else {
          if (target.color !== color) moves.push({ row: r, col: c });
          break;
        }
        r += dr;
        c += dc;
      }
    }
    return moves;
  }

  _knightMoves(row, col, color) {
    const moves = [];
    const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of offsets) {
      const r = row + dr, c = col + dc;
      if (!this._inBounds(r, c)) continue;
      const target = this.board[r][c];
      if (!target || target.color !== color) {
        moves.push({ row: r, col: c });
      }
    }
    return moves;
  }

  _kingMoves(row, col, color) {
    const moves = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr, c = col + dc;
        if (!this._inBounds(r, c)) continue;
        const target = this.board[r][c];
        if (!target || target.color !== color) {
          moves.push({ row: r, col: c });
        }
      }
    }

    // Castling
    const opponent = color === 'white' ? 'black' : 'white';
    const rights = this.castlingRights[color];
    const homeRow = color === 'white' ? 7 : 0;

    // King must be on home square and not in check
    if (row === homeRow && col === 4 && !this._isSquareAttacked(row, col, opponent)) {
      // King-side: e→g, rook on h file
      if (rights.kingSide && this.board[row][7] &&
          this.board[row][7].type === 'rook' && this.board[row][7].color === color &&
          !this.board[row][5] && !this.board[row][6] &&
          !this._isSquareAttacked(row, 5, opponent) &&
          !this._isSquareAttacked(row, 6, opponent)) {
        moves.push({ row, col: 6 });
      }
      // Queen-side: e→c, rook on a file
      if (rights.queenSide && this.board[row][0] &&
          this.board[row][0].type === 'rook' && this.board[row][0].color === color &&
          !this.board[row][1] && !this.board[row][2] && !this.board[row][3] &&
          !this._isSquareAttacked(row, 3, opponent) &&
          !this._isSquareAttacked(row, 2, opponent)) {
        moves.push({ row, col: 2 });
      }
    }

    return moves;
  }

  // ── Internal: Attack / Check Detection ───────────────────────────────

  /**
   * Is a square attacked by the given attacker color?
   * Uses direct piece-pattern checks (not move generation) to avoid recursion.
   */
  _isSquareAttacked(row, col, attackerColor) {
    // Pawn attacks — check squares where an enemy pawn could be attacking from
    const pawnDir = attackerColor === 'white' ? 1 : -1;
    for (const dc of [-1, 1]) {
      const pr = row + pawnDir, pc = col + dc;
      if (this._inBounds(pr, pc)) {
        const p = this.board[pr][pc];
        if (p && p.type === 'pawn' && p.color === attackerColor) return true;
      }
    }

    // Knight attacks
    const knightOffsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of knightOffsets) {
      const nr = row + dr, nc = col + dc;
      if (this._inBounds(nr, nc)) {
        const p = this.board[nr][nc];
        if (p && p.type === 'knight' && p.color === attackerColor) return true;
      }
    }

    // King attacks (adjacent)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const kr = row + dr, kc = col + dc;
        if (this._inBounds(kr, kc)) {
          const p = this.board[kr][kc];
          if (p && p.type === 'king' && p.color === attackerColor) return true;
        }
      }
    }

    // Rook/Queen on ranks and files
    const rookDirs = [[0,1],[0,-1],[1,0],[-1,0]];
    for (const [dr, dc] of rookDirs) {
      let r = row + dr, c = col + dc;
      while (this._inBounds(r, c)) {
        const p = this.board[r][c];
        if (p) {
          if (p.color === attackerColor && (p.type === 'rook' || p.type === 'queen')) return true;
          break;
        }
        r += dr; c += dc;
      }
    }

    // Bishop/Queen on diagonals
    const bishopDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dr, dc] of bishopDirs) {
      let r = row + dr, c = col + dc;
      while (this._inBounds(r, c)) {
        const p = this.board[r][c];
        if (p) {
          if (p.color === attackerColor && (p.type === 'bishop' || p.type === 'queen')) return true;
          break;
        }
        r += dr; c += dc;
      }
    }

    return false;
  }

  /**
   * Would moving piece from (fromRow,fromCol) to (toRow,toCol)
   * leave the given color's king in check?
   * Temporarily applies the move and checks.
   */
  _moveLeavesKingInCheck(fromRow, fromCol, toRow, toCol, color) {
    const savedBoard = this.board.map(r => r.slice());
    const savedEP = this.enPassantTarget;

    const piece = this.board[fromRow][fromCol];

    // En passant capture on temp board
    if (piece.type === 'pawn' && this.enPassantTarget &&
        toRow === this.enPassantTarget.row && toCol === this.enPassantTarget.col) {
      const capRow = color === 'white' ? toRow + 1 : toRow - 1;
      this.board[capRow][toCol] = null;
    }

    // Castling rook on temp board
    if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
      if (toCol > fromCol) {
        this.board[fromRow][5] = this.board[fromRow][7];
        this.board[fromRow][7] = null;
      } else {
        this.board[fromRow][3] = this.board[fromRow][0];
        this.board[fromRow][0] = null;
      }
    }

    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

    const kingPos = this._findKing(color);
    const opponent = color === 'white' ? 'black' : 'white';
    const inCheck = kingPos ? this._isSquareAttacked(kingPos.row, kingPos.col, opponent) : false;

    // Restore
    this.board = savedBoard;
    this.enPassantTarget = savedEP;

    return inCheck;
  }

  _findKing(color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.type === 'king' && p.color === color) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  }

  // ── Internal: Notation Helpers ───────────────────────────────────────

  _generateAlgebraic(fromRow, fromCol, toRow, toCol, piece, captured, promotion) {
    // Castling
    if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
      return toCol > fromCol ? 'O-O' : 'O-O-O';
    }

    const pieceLetters = { knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K' };
    let notation = '';

    if (piece.type === 'pawn') {
      const isCapture = captured ||
        (this.enPassantTarget && toRow === this.enPassantTarget.row && toCol === this.enPassantTarget.col);
      if (isCapture) {
        notation += String.fromCharCode(97 + fromCol) + 'x';
      }
      notation += this._toAlgebraicSquare(toRow, toCol);
      if (promotion) {
        const promoLetters = { queen: 'Q', rook: 'R', bishop: 'B', knight: 'N' };
        notation += '=' + promoLetters[promotion];
      }
    } else {
      notation += pieceLetters[piece.type] || '';
      const disambig = this._getDisambiguation(fromRow, fromCol, toRow, toCol, piece);
      notation += disambig;
      if (captured) notation += 'x';
      notation += this._toAlgebraicSquare(toRow, toCol);
    }

    return notation;
  }

  _getDisambiguation(fromRow, fromCol, toRow, toCol, piece) {
    const others = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (r === fromRow && c === fromCol) continue;
        const p = this.board[r][c];
        if (!p || p.type !== piece.type || p.color !== piece.color) continue;
        const moves = this.getValidMoves(r, c);
        if (moves.some(m => m.row === toRow && m.col === toCol)) {
          others.push({ row: r, col: c });
        }
      }
    }
    if (others.length === 0) return '';

    const sameFile = others.some(o => o.col === fromCol);
    const sameRank = others.some(o => o.row === fromRow);

    if (!sameFile) return String.fromCharCode(97 + fromCol);
    if (!sameRank) return String(8 - fromRow);
    return String.fromCharCode(97 + fromCol) + String(8 - fromRow);
  }

  // ── Internal: Coordinate Helpers ─────────────────────────────────────

  _toAlgebraicSquare(row, col) {
    return String.fromCharCode(97 + col) + String(8 - row);
  }

  _fromAlgebraicSquare(sq) {
    const col = sq.charCodeAt(0) - 97;
    const row = 8 - parseInt(sq[1]);
    return { row, col };
  }

  _inBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }
}

// Export for browser
window.ChessEngine = ChessEngine;
