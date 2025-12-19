import { useState, useRef, useEffect } from 'react';
import Modal from '@/components/modal';
import Button from "@/components/button";

interface Props {
  show: boolean;
  onClose: () => void;
}

const NewChapterModal = ({ show, onClose }: Props) => {
  const [title, setTitle] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
  if (show && inputRef.current) {
    inputRef.current.focus();
  }
    }, [show]);

	const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
		setIsSubmitting(true);
    console.log('New chapter title:', title);
	};

  return (
    <Modal show={show}>
      <div className='bg-background-page p-4 rounded-md'>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor={'chapter-title'} className="text-sm">
            Enter a title for the new chapter:
          </label>
          <input
            id={'chapter-title'}
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="p-2 px-4 rounded bg-background text-foreground border border-[#555]"
            placeholder="New Chapter Title"
          />
          <div className='flex flex-row justify-evenly'>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : 'Create'}
            </Button>
            <Button
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export default NewChapterModal;
