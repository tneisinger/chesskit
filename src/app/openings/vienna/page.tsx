'use client';

import React, { useState } from 'react';
import LessonSession from '@/components/lessonSession';
import { Lesson } from '@/types/lesson';
import { PieceColor } from '@/types/chess'

const pgn = `
1. e4 e5 2. Nc3 Nf6 (2... Nc6 3. Bc4 Bc5 (3... Nf6 4. d3 Bc5 (4... Na5 5. Bb3
Bb4 (5... Nxb3 6. axb3 d5 7. exd5 Nxd5 8. Nf3) 6. Nf3 Nxb3 7. axb3) (4... Be7 5.
Nf3 O-O 6. O-O Na5 7. Nxe5 Nxc4 8. dxc4) 5. Nf3 O-O (5... Ng4 6. O-O) 6. O-O h6
7. Nd5 (7. Na4)) 4. Qg4 d5 (4... g6 5. Qf3 Qf6 (5... Nf6 6. Nge2 d6 (6... O-O 7.
d3 d6 8. Bg5 Kg7 9. Nd5 Qd7 (9... Nxd5 10. Bxd8) 10. Qxf6+ Kg8 11. Bh6 a6 12.
Qg7#) 7. d3 Bg4 8. Qg3 Be6 9. Bg5) 6. Nd5 Qxf3 7. Nxf3) (4... Qf6 5. Nd5 Qxf2+
6. Kd1 Kf8 (6... g6 7. Nh3 Qd4 (7... d6 8. Nxf2 Bxg4+ 9. Nxg4) 8. d3) 7. Nh3 h5
(7... Qd4 8. d3 d6 (8... Nf6 9. Nxf6 gxf6 10. Bh6+ Ke7 11. Qg7) 9. Qf3 Bxh3 10.
Rf1 Be6 11. c3) 8. Qg5 Qd4 9. d3) 5. Qxg7 Qf6 6. Qxf6 Nxf6 7. Nxd5) (2... Bc5 3.
Qh5 d6 (3... Qf6 4. Nf3 d6 5. Nd5 Qd8 6. d4 Bxd4 7. Nxd4 exd4 8. Bg5) (3... Qe7
4. Nd5 Nf6 5. Nxe7 Nxh5 6. Nxc8 Nc6 (6... O-O 7. b4 Bxb4 8. Rb1 Nc6 9. Rxb4 Nxb4
10. Ne7+ Kh8 11. c3 Nxa2 12. Ba3 Rfe8 13. Bc4 Nc1 14. Kd1) 7. Nxa7 Bxa7 8. c3
O-O 9. Nf3) 4. Bc4 Qd7 (4... Qe7 5. Nd5 Qd7 6. Qg5 f6 (6... g6 7. Nf3) 7. Qh5+
g6 8. Qf3) (4... Qf6 5. Nf3 Ne7 6. d3) (4... g6 5. Qf3 Nf6 6. d3 Nc6 7. Bg5) 5.
Qg5 Qg4 6. Qxg4 Bxg4 7. Nd5 Bb6 8. a4 c6 9. a5 Bxf2+ (9... Bd8 10. Ne3) (9...
cxd5 10. axb6 dxc4 11. Rxa7) 10. Kxf2 cxd5 11. Bxd5) 3. f4 exf4 (3... Nc6 4.
fxe5 Nxe5 5. d4 Nc6 6. e5 Ng8 7. Nf3) (3... d5 4. fxe5 Nxe4 5. Qf3 Nc6 (5...
Nxc3 6. dxc3 (6. bxc3) 6... c5 (6... Be6 7. Qg3 Nc6 (7... c5 8. Bb5+ Nc6 9.
Bxc6+ bxc6 10. Nf3 h6 11. O-O) 8. Nf3 Qd7 9. Bb5 a6 10. Bxc6 Qxc6 11. Nd4 Qd7
12. O-O O-O-O) (6... Nc6 7. Bb5) 7. Bf4 Nc6 8. O-O-O Be6 9. Bc4 Ne7 10. Bb5+ Nc6
11. c4) (5... f5 6. d3 Nxc3 7. bxc3 d4 8. Qg3) 6. Bb5 Nxc3 7. dxc3 Qh4+ 8. g3
Qe4+ 9. Qxe4 dxe4 10. Be3) 4. e5 Ng8 (4... Qe7 5. Qe2 Ng8 6. Nf3 d6 (6... Nc6 7.
d4) 7. Nd5 Qd8 (7... Qd7 8. exd6+ Kd8 9. dxc7+ Qxc7 10. Nxc7 Kxc7) 8. exd6+ Be6
9. Nxc7+ Kd7 10. Ne5+ Kxd6 (10... Kc8 11. Nxe6 fxe6 12. Qc4+ Nc6 13. Qxc6+ bxc6
14. Ba6+ Kb8 15. Nxc6#) 11. Nxe6 Kxe6 (11... fxe6 12. Nf7+) (11... Qe8 12. Nc4+)
12. Nc6+) 5. Nf3 d6 6. d4 dxe5 7. Qe2 Be7 8. Qxe5 Nf6 9. Bxf4 *
`;

const antiLondonPgn = `
1. d4 d5 2. Bf4 Nf6 3. e3 c5 4. c3 (4. dxc5 e6 5. Nf3 Bxc5) (4. Nc3 cxd4 5. exd4
a6) 4... Nc6 5. dxc5 (5. Nd2 Qb6 (5... Bf5 6. Ngf3 Qb6) 6. Qb3 (6. Qc2 g6 7.
Ngf3 Bg7 8. h3 O-O 9. Be2 Bf5) (6. Qc1 cxd4 7. exd4 Bf5) 6... c4 7. Qxb6 (7. Qa3
e5) 7... axb6 8. a3 (8. Bg5 b5 9. Bxf6 exf6) 8... b5 9. Ngf3 (9. e4 Nxe4) (9.
Rc1 Bf5 10. Ngf3 h6 11. Be2 e6 12. O-O Nd7 13. h3 Nb6 14. Rfe1 (14. Bd1 Na4 15.
Bxa4 bxa4 16. Bh2 (16. Rfe1 Bd3 17. e4 Kd7 18. exd5 exd5 19. Ne5+ Nxe5 20. Rxe5
Ra5) 16... Ra6 17. Rfe1 Bd3 18. e4 dxe4 19. Nxe4 Kd7) 14... Na4) 9... b4 10.
cxb4 Nxb4) (5. Nf3 g6 6. h3 (6. Bb5 Qb6) 6... Bg7) (5. Bb5 Qb6 6. Qb3 (6. a4 e6)
6... c4 7. Qa4 e6 8. Nf3 Bd7 9. Nbd2 Nh5 10. O-O Nxf4 11. exf4) 5... e5 6. Bg3 *
`;

const fantasyPgn = `
1. e4 c6 2. d4 d5 3. f3 dxe4 (3... Nf6 4. e5 Nfd7 5. c3 e6 6. f4 c5 7. Nf3)
(3... g6 4. Nc3 Bg7 5. e5 (5. Be3 e6 6. Qd2 Ne7 7. O-O-O O-O 8. h4 h5 9. g4))
(3... e6 4. Nc3 Nf6 (4... Bb4 5. Ne2) 5. e5) (3... Qb6 4. a4 (4. c3 e5 5. Qe2)
4... dxe4 (4... e5 5. dxe5) (4... Qa5+ 5. c3) 5. a5) (3... c5 4. exd5 Qxd5 5.
Ne2 cxd4 6. Nbc3 Qe6 7. Qxd4) 4. fxe4 e5 (4... Nf6 5. e5 Nd5 (5... Ne4 6. Nf3)
6. c4 Nb6 (6... Nb4 7. a3 Qxd4 8. axb4 Qh4+ 9. Kd2 Bf5 10. Nf3 Qf2+ 11. Qe2) 7.
Nc3 Bf5 8. Nf3 e6 9. Bd3) (4... g6 5. Nc3 Bg7 6. Nf3 c5 (6... Nf6 7. e5 Nd5 8.
Bd3) 7. dxc5) 5. Nf3 Bg4 (5... exd4 6. Bc4 Nf6 7. O-O Bc5 8. Ng5 O-O 9. Nxf7 (9.
e5 Nd5 10. Qd3 g6 11. Ne4) 9... Rxf7 (9... Qe7 10. Ne5+ Be6 11. Bxe6+) 10. Bxf7+
Kxf7 11. Qh5+ Kg8 (11... g6 12. Qxh7+) 12. Qxc5) 6. Bc4 Nf6 (6... Nd7 7. c3 Ngf6
8. Qb3 Qe7 9. Qxb7 Rb8 (9... Nb6 10. Qxc6+) 10. Qxc6) 7. Bxf7+ Kxf7 8. Nxe5+ Kg8
9. Nxg4 *
`;

const lesson: Lesson = {
  title: 'Vienna Game',
  userColor: PieceColor.WHITE,
  pgn,
};

const antiLondonLesson: Lesson = {
  title: 'Anti-London',
  userColor: PieceColor.BLACK,
  pgn: antiLondonPgn,
}

const fantasyLesson: Lesson = {
  title: 'Fantasy Variation',
  userColor: PieceColor.WHITE,
  pgn: fantasyPgn,
}

const Page = () => {
  const [currentLesson, setCurrentLesson] = useState<Lesson>(lesson);

  return (
    <>
      <LessonSession lesson={currentLesson}/>
      <button onClick={() => setCurrentLesson(fantasyLesson)}>Change Lesson</button>
    </>
  );
}

export default Page;
