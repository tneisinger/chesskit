'use client';

import React from 'react';
import LessonSession from '@/components/lessonSession';
import { Lesson } from '@/types/lesson';
import { PieceColor } from '@/types/chess'

const pgn1 = `
1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 (5. e5 Qa5+ 6. Nc3 Qxe5+) 5...
Nc6 6. Ndb5 d6 7. Bf4 e5 8. Bg5 a6 9. Bxf6 gxf6 10. Na3 b5 11. Nd5 Bg7 12. Bd3
Ne7 13. Nxe7 Qxe7 14. O-O O-O *
`;

const chapter1 = {
  title: 'Sicilian Defense',
  pgn: pgn1
};

const lesson: Lesson = {
  title: 'Sicilian Defense',
  userColor: PieceColor.BLACK,
  chapters: [chapter1],
};

const Page = () => {
  return <LessonSession lesson={lesson}/>;
}

export default Page;
