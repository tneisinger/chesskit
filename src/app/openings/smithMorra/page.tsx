'use client';

import React from 'react';
import LessonSession from '@/components/lessonSession';
import { Lesson } from '@/types/lesson';
import { PieceColor } from '@/types/chess'

const pgn1 = `
1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 Nc6 5. Nf3 d6 6. Bc4 Nf6 (6... Bg4 7.
Bxf7+ Kxf7 8. Ng5+ Ke8 9. Qxg4) 7. e5 Nxe5 (7... Ng4 8. e6 fxe6 9. Ng5 Nge5 10.
Bb3 d5 11. Bf4) (7... dxe5 8. Qxd8+ Kxd8 (8... Nxd8 9. Nb5 Kd7 (9... Ne6 10.
Bxe6 Bxe6 11. Nc7+) (9... Rb8 10. Nxe5 e6 11. Nc7+ Ke7 12. Be3 Kd6 13. Bf4 Kxc7
14. Nxf7+) 10. Nxe5+ Ke8 11. Nc7#) 9. Ng5 Na5 10. Bxf7) 8. Nxe5 dxe5 9. Bxf7+
Kxf7 10. Qxd8 *
`;

const chapter1 = {
  title: 'Simple Traps',
  pgn: pgn1,
};


const pgn2 = `
1. e4 c5 2. d4 cxd4 3. c3 dxc3 (3... e5 4. Nf3 dxc3 5. Nxc3 Nc6 6. Bc4 Nf6 (6...
Be7 7. Qd5) 7. Ng5 d5 8. exd5 Nd4 9. d6 Be6 10. Nxe6 fxe6 11. Be3 Qxd6 12. O-O)
4. Nxc3 Nc6 (4... e6 5. Nf3 a6 6. Bc4 b5 7. Bb3 Bb7 8. Qe2 d6 9. O-O Nf6 10. e5
dxe5 11. Nxe5 Be7 12. Nxf7 Kxf7 13. Qxe6+ Kg6 (13... Ke8 14. Qf7+ Kd7 15. Rd1+
Kc8 16. Rxd8+ Kxd8 17. Be3) 14. Bc2+) 5. Nf3 e6 6. Bc4 d6 7. O-O Nf6 8. Qe2 Be7
9. Rd1 Qc7 10. Bf4 e5 11. Bg5 a6 12. Rac1 Bg4 13. h3 Nd4 14. Rxd4 Bxf3 15. Qxf3
exd4 16. Nb5 axb5 (16... Qd8 17. Nc7+ Qxc7 (17... Kf8 18. Nxa8 Qxa8 19. Bb3 Qb8
20. Bxf6 Bxf6 21. Qh5 g6 22. Qd5 Qe8 23. Rc8 Qxc8 24. Qxf7#) (17... Kd7 18. Bb5+
axb5 19. Qf5#) 18. Bxf7+ Kxf7 19. Rxc7) 17. Bxb5+ *
`;

const chapter2 = {
  title: 'Tricky Lines',
  pgn: pgn2,
};

const pgn3 = `
1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 e6 5. Nf3 Nc6 6. Bc4 Nf6 7. O-O Qc7 8.
Nb5 Qb8 9. e5 Nxe5 10. Nxe5 Qxe5 11. Re1 Qb8 (11... Qc5 12. Bf1 a6 (12... Nd5
13. Bg5 b6 (13... f6 14. Rc1) 14. Qxd5 Qxd5 15. Nc7#) 13. Be3 Qc6 14. Na7) 12.
Qd4 a6 13. Bf4 d6 14. Bxd6 Bxd6 15. Nxd6+ Ke7 16. Nf5+ Kf8 17. Qd8+ Ne8 18. Qe7+
Kg8 19. Qxe8# *
`;

const chapter3 = {
  title: 'Preventing a Black Trap',
  pgn: pgn3,
};

const pgn4 = `
1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 Nc6 5. Nf3 e6 6. Bc4 a6 7. O-O b5 8. Bb3
Bb7 9. Qe2 Nge7 10. Be3 Ng6 11. Nd5 exd5 12. exd5 Nce7 (12... Be7 13. dxc6 Bxc6
14. Ng5 O-O 15. Nxh7 Kxh7 16. Qh5+ Kg8 17. Qxg6) 13. d6 Nf5 14. Bb6+ Be7 15.
Bxd8 *
`

const chapter4 = {
  title: 'Knight d5 Sacrifice',
  pgn: pgn4,
};

const pgn5 = `
1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 Nc6 5. Nf3 e6 6. Bc4 Bb4 7. O-O Nge7 8.
Qc2 O-O 9. Rd1 Ng6 10. Bg5 f6 (10... Qa5 11. Rac1) (10... Be7 11. Bxe7) 11.
Bxe6+ Kh8 12. Be3 *
`;

const chapter5 = {
  title: 'If Black plays Bb4...',
  pgn: pgn5,
};


const pgn6 = `
1. e4 c5 2. d4 cxd4 3. c3 d3 (3... e5 4. Nf3 Nc6 5. Bc4 Nf6 6. Ng5 d5 7. exd5
Na5 8. Bb5+ Bd7 9. Qe2 Bd6 10. b4) (3... d5 4. exd5 Qxd5 5. cxd4 e5 (5... Nc6 6.
Nf3 e5 7. Nc3 Bb4 8. Bd2 Bxc3 9. Bxc3 exd4 (9... e4 10. Ne5 Nxe5 11. dxe5 Ne7
12. Qe2 O-O 13. Rd1 Qc6 (13... Qxa2 14. Bb4 Qe6 15. Qxe4 Re8 16. Bb5 Nc6 17.
O-O) 14. Rd6 Qa4 15. b3 Qa3 16. Qd2) 10. Nxd4 Nf6 11. Qe2+ Be6 12. O-O-O) 6. Nf3
exd4 7. Qxd4 Nf6 8. Nc3 Qxd4 9. Nxd4 Bb4 10. Nb5) (3... Nf6 4. e5 Nd5 5. Qxd4 e6
6. Nf3 Nc6 7. Qe4 d6 (7... f5 8. Qe2 Qc7 9. g3 b5 10. Bg2 a5 11. O-O Ba6 (11...
Be7 12. Bg5 Ba6 13. Bxe7 Ndxe7 14. Re1) 12. Nh4 b4 13. c4 g6 14. Nd2) 8. Bb5 Bd7
9. c4 Nc7 (9... Nb6 10. exd6 Bxd6 11. O-O a6 12. Rd1 axb5 13. Rxd6 bxc4 14. Nc3)
10. exd6 Bxd6 11. O-O a6 12. Ba4 O-O 13. Rd1) 4. Bxd3 Nc6 5. c4 g6 6. Nf3 Bg7 7.
O-O d6 8. h3 *
`;

const chapter6 = {
  title: 'Smith-Morra Declined',
  pgn: pgn6,
};


const lesson: Lesson = {
  title: 'The Smith-Morra Gambit',
  userColor: PieceColor.WHITE,
  chapters: [chapter1, chapter2, chapter3, chapter4, chapter5, chapter6],
};

const Page = () => {
  return <LessonSession lesson={lesson}/>;
}

export default Page;
