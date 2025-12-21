import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Modal from '@/components/modal';
import Button from "@/components/button";
import { Lesson } from '@/types/lesson';
import { updateLesson } from '@/app/openings/actions';
import { updateUserLesson } from '@/app/my-repertoire/actions';

interface Props {
  show: boolean;
  lesson: Lesson;
  onClose: () => void;
}

const NewChapterModal = ({ show, lesson, onClose }: Props) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
  if (show && inputRef.current) {
    inputRef.current.focus();
    setTitle('');
  }
    }, [show]);

	const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Please enter a chapter title');
      return;
    }

		setIsSubmitting(true);

    try {
      // Create new chapter with empty PGN
      const newChapter = {
        title: title.trim(),
        pgn: '',
      };

      // Add the new chapter to the lesson's chapters array
      const updatedChapters = [...lesson.chapters, newChapter];
      const newChapterIdx = updatedChapters.length - 1;

      const updatedLesson: Lesson = {
        ...lesson,
        chapters: updatedChapters,
      };

      let result;

      // Check if this is a user lesson (has id) or system lesson (uses title)
      if (lesson.id !== undefined) {
        // User lesson - update via updateUserLesson
        result = await updateUserLesson(lesson.id, updatedLesson);
      } else {
        // System lesson - update via updateLesson
        result = await updateLesson(lesson.title, updatedLesson);
      }

      console.log('Update result:', result);

      if (result.success) {
        // Create new URL with chapterIdx query parameter
        const params = new URLSearchParams(searchParams);
        params.set('chapterIdx', newChapterIdx.toString());

        // Redirect to the same page with the new chapter selected
        router.push(`${pathname}?${params.toString()}`);
        setIsSubmitting(false);
        onClose();
      } else {
        alert(`Failed to create chapter: ${result.error}`);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error creating chapter:', error);
      alert('An unexpected error occurred while creating the chapter');
      setIsSubmitting(false);
    }
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
