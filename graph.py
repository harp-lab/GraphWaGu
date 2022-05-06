import random

class Node:
    def __init__(self, k, v, x, y, size):
        self.k = k
        self.v = v
        self.x = x
        self.y = y
        self.size = size

nodes = []
for i in range(1031):
    nodes.append(Node(i, random.uniform(0, 1), random.uniform(0, 1), random.uniform(0, 1), 1))
f = open("e1.txt", "w")
for node in nodes:
    out = f"{node.k}\t{node.v}\n"
    f.write(out)
f = open("l1.txt", "w")
for node in nodes:
    out = f"{node.k}\t{node.x}\t{node.y}\t{node.size}\n"
    f.write(out)
f = open("n1.txt", "w")
for i in range(1030):
    for j in range(i+1, 1031):
        out = f"{nodes[i].k}\t{nodes[j].k}\t1\n"
        f.write(out)


