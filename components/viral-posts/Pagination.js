import { Button } from '@/components/ui/button';

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  return (
    <div className="flex justify-center gap-2 mt-6">
      {Array.from({ length: totalPages }, (_, i) => (
        <Button
          key={i + 1}
          variant={currentPage === i + 1 ? 'default' : 'outline'}
          onClick={() => onPageChange(i + 1)}
          className={currentPage === i + 1 ? 'bg-[#FF4400]' : ''}
        >
          {i + 1}
        </Button>
      ))}
    </div>
  );
} 