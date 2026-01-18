import React, { Dispatch, SetStateAction, useState } from 'react';
import { ChessWebsite } from '@/types/chess';
import Button from '@/components/button';

interface Props {
  chessWebsite: ChessWebsite;
  setUsername: Dispatch<SetStateAction<string | undefined>>;
  initialUsername?: string;
}

const UsernameForm = ({ chessWebsite, setUsername, initialUsername }: Props) => {

  const [usernameTxt, setUsernameTxt] = useState(initialUsername || '');

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUsername(usernameTxt);
  }

  return (
    <form onSubmit={handleFormSubmit}>
      <label>
        <div>
          What is your {chessWebsite} username?
        </div>
        <input
          className='mt-2 mb-3 p-2 border rounded w-full'
          required
          autoFocus
          type='text'
          value={usernameTxt}
          onChange={(e) => setUsernameTxt(e.target.value)}
        />
      </label>
      <div className="flex flex-row justify-center">
        <Button
          type='submit'
          disabled={usernameTxt.length < 1}
        >
          Fetch Games
        </Button>
      </div>
    </form>
  );
}

export default UsernameForm;
