# Compute E8 roots, edges and Petrie (Coxeter-plane) projection; dump as JSON for the page.
import itertools, json, numpy as np
roots = []
for i, j in itertools.combinations(range(8), 2):
    for si in (1, -1):
        for sj in (1, -1):
            v = [0]*8; v[i] = si; v[j] = sj; roots.append(v)
for signs in itertools.product((1, -1), repeat=8):
    if signs.count(-1) % 2 == 0:
        roots.append([s*0.5 for s in signs])
R = np.array(roots, float); assert len(R) == 240
w = np.array([1, 2.3, 3.7, 5.1, 6.9, 8.3, 9.7, 13.1])
pos = R[R @ w > 0]
sums = {tuple(np.round(a+b, 6)) for a in pos for b in pos}
simple = np.array([p for p in pos if tuple(np.round(p, 6)) not in sums]); assert len(simple) == 8
C = np.eye(8)
for a in simple:
    C = C @ (np.eye(8) - np.outer(a, a))   # |a|^2 = 2 -> reflection I - a a^T
vals, vecs = np.linalg.eig(C)
k = np.argmin(np.abs(vals - np.exp(2j*np.pi/30)))
v = vecs[:, k]; u1 = v.real; u2 = v.imag
u1 /= np.linalg.norm(u1); u2 -= u1*(u1@u2); u2 /= np.linalg.norm(u2)
G = R @ R.T
edges = [(i, j) for i in range(240) for j in range(i+1, 240) if abs(G[i, j]-1) < 1e-9]
print(len(edges))
P = np.stack([R @ u1, R @ u2], 1)
rad = np.round(np.hypot(P[:, 0], P[:, 1]), 4); print(sorted(set(rad)))
json.dump({'roots': (R*2).astype(int).tolist(), 'u1': u1.round(8).tolist(), 'u2': u2.round(8).tolist(), 'edges': edges},
          open('e8.json', 'w'), separators=(',', ':'))
