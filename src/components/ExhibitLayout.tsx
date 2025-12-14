import { Home, ChevronLeft, ChevronRight, LayoutGrid, LucideIcon } from 'lucide-react';
import './ExhibitLayout.css';

interface ExhibitLayoutProps {
  children: React.ReactNode;
  onGoHome?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onShowTOC?: () => void;
  showPrevious?: boolean;
  showNext?: boolean;
  previousIcon?: LucideIcon | null;
  nextIcon?: LucideIcon | null;
  fadeOut?: boolean;
  fadeOutNav?: boolean;
}

const ExhibitLayout = ({ 
  children, 
  onGoHome, 
  onPrevious, 
  onNext,
  onShowTOC,
  showPrevious = true,
  showNext = true,
  previousIcon,
  nextIcon,
  fadeOut = false,
  fadeOutNav = false
}: ExhibitLayoutProps) => {
  return (
    <div className="exhibit-layout">
      <button 
        className={`home-button ${fadeOutNav ? 'fade-out' : ''}`}
        onClick={onGoHome}
        aria-label="Go to home"
      >
        <Home className="home-icon" />
      </button>

      <button 
        className={`toc-button ${fadeOutNav ? 'fade-out' : ''}`}
        onClick={onShowTOC}
        aria-label="Show all exhibits"
      >
        <LayoutGrid className="toc-icon" />
      </button>

      {showPrevious && (
        <button 
          className={`nav-button nav-button-left ${fadeOutNav ? 'fade-out' : ''}`}
          onClick={onPrevious}
          aria-label="Previous exhibit"
        >
          <ChevronLeft className="nav-icon nav-chevron" />
          {previousIcon && (() => {
            const PrevIcon = previousIcon;
            return <PrevIcon className="nav-icon nav-exhibit-icon" />;
          })()}
        </button>
      )}

      {showNext && (
        <button 
          className={`nav-button nav-button-right ${fadeOutNav ? 'fade-out' : ''}`}
          onClick={onNext}
          aria-label="Next exhibit"
        >
          {nextIcon && (() => {
            const NextIcon = nextIcon;
            return <NextIcon className="nav-icon nav-exhibit-icon" />;
          })()}
          <ChevronRight className="nav-icon nav-chevron" />
        </button>
      )}

      <div className={`exhibit-content ${fadeOut ? 'fade-out' : 'fade-in'}`}>
        {children}
      </div>
    </div>
  );
};

export default ExhibitLayout;

