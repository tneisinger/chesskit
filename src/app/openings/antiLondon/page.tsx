'use client';

import React from 'react';
import LessonSession from '@/components/lessonSession';
import { Lesson } from '@/types/lesson';
import { PieceColor } from '@/types/chess'

const pgn1 = `
1. d4 Nf6 2. Bf4 c5 3. e3 (3. c3 cxd4 4. cxd4 Qb6 5. b3 (5. Qd2 Nc6 6. e3 Ne4 7.
Qc2 Nb4 8. Qxe4 d5 9. Qf3 Nc2+ 10. Kd1 Nxa1 11. b3 Nxb3 12. axb3 Qxb3+ 13. Kc1
Bf5) 5... Nc6 6. e3 (6. Nf3 Ne4 7. e3 g5 8. Bxg5 (8. Bg3 h5) 8... Nxg5 9. Nxg5
Qa5+ 10. Qd2 Qxg5) 6... e5 7. dxe5 Bb4+ 8. Nd2 (8. Ke2 Nxe5 9. Bxe5 Qb5+ 10. Qd3
Qxe5) 8... Ne4 9. Nf3 g5 10. Bxg5 Nxe5) (3. d5 d6) (3. dxc5 Na6) 3... cxd4 4.
exd4 Qb6 5. b3 (5. Nc3 a6 6. Nf3 (6. a3 d5) 6... Qxb2 7. Na4 Qb4+ 8. c3 Qa5 9.
Rb1 b5) 5... d5 6. Nf3 Bg4 7. c3 *
`;

const chapter1 = {
  title: 'Anti-London',
  pgn: pgn1,
};

const lesson: Lesson = {
  title: "Daniel Naroditsky's Anti-London",
  userColor: PieceColor.BLACK,
  chapters: [chapter1],
};

const Page = () => {
  return <LessonSession lesson={lesson}/>;
}

export default Page;
