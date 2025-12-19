import { Target, Wind, Activity, Grid3x3 } from 'lucide-react';
import './TableOfContentsPage.css';

interface TableOfContentsPageProps {
  onSelectExhibit: (index: number) => void;
}

const TableOfContentsPage = ({ onSelectExhibit }: TableOfContentsPageProps) => {
  const exhibits = [
    {
      id: 0,
      icon: Target,
    },
    {
      id: 1,
      icon: Wind,
    },
    {
      id: 2,
      icon: Activity,
    },
    {
      id: 3,
      icon: Grid3x3,
    },
    null, // Placeholder
    null, // Placeholder
    null, // Placeholder
    null, // Placeholder
    null, // Placeholder
    null, // Placeholder
    null, // Placeholder
    null, // Placeholder
    null, // Placeholder
    null, // Placeholder
    null, // Placeholder
    null, // Placeholder
  ];

  return (
    <div className="table-of-contents">
      <div className="exhibit-grid">
        {exhibits.map((exhibit, index) => {
          if (!exhibit) {
            return <div key={index} className="exhibit-card placeholder" />;
          }
          
          const Icon = exhibit.icon;
          return (
            <button
              key={exhibit.id}
              className="exhibit-card"
              onClick={() => onSelectExhibit(exhibit.id)}
              aria-label={`Go to exhibit ${exhibit.id + 1}`}
            >
              <Icon className="exhibit-icon" size={40} strokeWidth={1.5} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TableOfContentsPage;
