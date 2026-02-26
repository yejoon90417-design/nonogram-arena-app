import json, time
from functools import lru_cache
from itertools import product
import psycopg

DB_DSN = "host=localhost port=5432 dbname=nonogram_prod user=postgres password=1234"

# 퍼즐당 최대 풀이 시간(초) - 25x25 기준 처음은 0.5~2.0 추천
TIME_LIMIT_SEC = 1.0

# 한 번에 가져올 raw 퍼즐 수
FETCH_BATCH = 200

# bit packing: index = y*w + x, bit0 = LSB of byte0
def pack_bits(grid, w, h) -> bytes:
    n = w * h
    out = bytearray((n + 7) // 8)
    for y in range(h):
        for x in range(w):
            if grid[y][x]:
                i = y * w + x
                out[i // 8] |= (1 << (i % 8))
    return bytes(out)

@lru_cache(maxsize=200000)
def line_patterns(length: int, clues: tuple[int, ...]):
    # clues empty means all zeros
    if len(clues) == 0:
        return [tuple(0 for _ in range(length))]

    k = len(clues)
    min_len = sum(clues) + (k - 1)
    if min_len > length:
        return []

    # distribute remaining spaces into k+1 gaps (before, between..., after)
    rem = length - min_len
    # gaps: g0, g1..gk where g1..g(k-1) are extra spaces between blocks (in addition to the mandatory 1)
    # We'll generate compositions of rem into (k+1) parts.
    res = []
    def gen_comp(n, parts):
        if parts == 1:
            yield (n,)
            return
        for i in range(n + 1):
            for tail in gen_comp(n - i, parts - 1):
                yield (i,) + tail

    for gaps in gen_comp(rem, k + 1):
        g0 = gaps[0]
        g_last = gaps[-1]
        mids = gaps[1:-1]  # length k-1 (maybe empty)
        line = [0] * g0
        for idx, block in enumerate(clues):
            line += [1] * block
            if idx < k - 1:
                line += [0] * (1 + mids[idx])  # mandatory 1 + extra
        line += [0] * g_last
        res.append(tuple(line))
    return res

def filter_patterns_by_known(patterns, known):
    # known: list of -1/0/1
    out = []
    for p in patterns:
        ok = True
        for i, kv in enumerate(known):
            if kv != -1 and p[i] != kv:
                ok = False
                break
        if ok:
            out.append(p)
    return out

def intersect(patterns, length):
    # returns forced cells: -1 unknown, else 0/1
    if not patterns:
        return None
    forced = []
    for i in range(length):
        v = patterns[0][i]
        same = True
        for p in patterns[1:]:
            if p[i] != v:
                same = False
                break
        forced.append(v if same else -1)
    return forced

def solve_nonogram(row_clues, col_clues, w, h, time_limit_sec=1.0, max_solutions=2):
    start = time.time()

    # grid values: -1 unknown, 0 empty, 1 filled
    grid = [[-1]*w for _ in range(h)]

    # initial candidate patterns for each row/col
    row_cands = []
    for r in range(h):
        pats = line_patterns(w, tuple(row_clues[r]))
        if not pats:
            return [], 0
        row_cands.append(pats)

    col_cands = []
    for c in range(w):
        pats = line_patterns(h, tuple(col_clues[c]))
        if not pats:
            return [], 0
        col_cands.append(pats)

    def time_up():
        return (time.time() - start) > time_limit_sec

    def propagate(grid, row_cands, col_cands):
        changed = True
        while changed:
            if time_up():
                return False, None, None
            changed = False

            # filter candidates by current grid
            for r in range(h):
                known = grid[r]
                new = filter_patterns_by_known(row_cands[r], known)
                if not new:
                    return False, None, None
                if len(new) != len(row_cands[r]):
                    row_cands[r] = new
                    changed = True
                forced = intersect(row_cands[r], w)
                for x in range(w):
                    if forced[x] != -1 and grid[r][x] != forced[x]:
                        grid[r][x] = forced[x]
                        changed = True

            for c in range(w):
                known = [grid[y][c] for y in range(h)]
                new = filter_patterns_by_known(col_cands[c], known)
                if not new:
                    return False, None, None
                if len(new) != len(col_cands[c]):
                    col_cands[c] = new
                    changed = True
                forced = intersect(col_cands[c], h)
                for y in range(h):
                    if forced[y] != -1 and grid[y][c] != forced[y]:
                        grid[y][c] = forced[y]
                        changed = True

        return True, grid, (row_cands, col_cands)

    solutions = []

    def choose_cell(grid):
        # pick an unknown cell with smallest branching based on row/col candidate forcedness
        best = None
        for y in range(h):
            for x in range(w):
                if grid[y][x] == -1:
                    return (y, x)  # simple first-unknown (fast enough for MVP)
        return None

    def dfs(grid, row_cands, col_cands):
        if time_up():
            return
        ok, grid2, cands = propagate([row[:] for row in grid],
                                     [list(p) for p in row_cands],
                                     [list(p) for p in col_cands])
        if not ok:
            return
        row_c2, col_c2 = cands

        cell = choose_cell(grid2)
        if cell is None:
            # solved
            sol = [[1 if v == 1 else 0 for v in row] for row in grid2]
            solutions.append(sol)
            return

        y, x = cell
        # branch 0 then 1 (order not important)
        for v in (0, 1):
            if len(solutions) >= max_solutions:
                return
            g3 = [row[:] for row in grid2]
            g3[y][x] = v
            dfs(g3, row_c2, col_c2)

    dfs(grid, row_cands, col_cands)
    return solutions, int((time.time() - start) * 1000)

def main():
    with psycopg.connect(DB_DSN) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            # puzzles 테이블에 아직 없는 raw만 가져오기
            cur.execute("""
                SELECT r.id, r.width, r.height, r.row_hints, r.col_hints
                FROM puzzles_raw r
                LEFT JOIN puzzles p ON p.id = r.id
                WHERE p.id IS NULL
                LIMIT %s
            """, (FETCH_BATCH,))
            rows = cur.fetchall()

        total_done = 0
        while rows:
            inserts = []
            for (pid, w, h, row_hints, col_hints) in rows:
                row_clues = row_hints
                col_clues = col_hints

                sols, ms = solve_nonogram(row_clues, col_clues, w, h, TIME_LIMIT_SEC, max_solutions=2)

                if len(sols) == 0:
                    # 못 풀었거나 모순
                    continue

                is_unique = (len(sols) == 1)
                sol_grid = sols[0]
                bits = pack_bits(sol_grid, w, h)

                inserts.append((pid, w, h, json.dumps(row_clues), json.dumps(col_clues), bits, is_unique, ms))

            if inserts:
                with psycopg.connect(DB_DSN) as conn:
                    with conn.cursor() as cur:
                        cur.executemany("""
                            INSERT INTO puzzles (id, width, height, row_hints, col_hints, solution_bits, is_unique, solve_time_ms)
                            VALUES (%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s,%s)
                            ON CONFLICT (id) DO NOTHING
                        """, inserts)
                total_done += len(inserts)
                print(f"inserted batch: {len(inserts)}, total: {total_done}")

            # 다음 배치
            with psycopg.connect(DB_DSN) as conn:
                conn.autocommit = True
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT r.id, r.width, r.height, r.row_hints, r.col_hints
                        FROM puzzles_raw r
                        LEFT JOIN puzzles p ON p.id = r.id
                        WHERE p.id IS NULL
                        LIMIT %s
                    """, (FETCH_BATCH,))
                    rows = cur.fetchall()

        print("done")

if __name__ == "__main__":
    main()
