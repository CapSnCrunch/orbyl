import { useState } from 'react'
import './App.css'
import DottedSpherePage from './pages/DottedSpherePage'
import WindStringsPage from './pages/WindStringsPage'
import ComingSoonPage from './pages/ComingSoonPage'
import TableOfContentsPage from './pages/TableOfContentsPage'
import ExhibitLayout from './components/ExhibitLayout'
import { Target, Wind, LucideIcon } from 'lucide-react'

function App() {
  const [showWelcome, setShowWelcome] = useState(true)
  const [showTOC, setShowTOC] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)
  const [fadeIn, setFadeIn] = useState(false)
  const [currentExhibit, setCurrentExhibit] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [fadeOutNav, setFadeOutNav] = useState(false)

  const exhibits = [
    <DottedSpherePage />,
    <WindStringsPage />,
    <ComingSoonPage />
  ]

  const exhibitIcons: (LucideIcon | null)[] = [
    Target,
    Wind,
    null // Coming Soon has no icon
  ]

  const handleStart = () => {
    setFadeOut(true)
    setTimeout(() => {
      setShowWelcome(false)
      setTimeout(() => {
        setFadeOut(false)
      }, 50)
    }, 400) // Wait for fade out animation to complete
  }

  const handleGoHome = () => {
    setFadeOut(true)
    setFadeOutNav(true)
    setTimeout(() => {
      setShowWelcome(true)
      setShowTOC(false)
      setCurrentExhibit(0)
      setTimeout(() => {
        setFadeOut(false)
        setFadeOutNav(false)
        setFadeIn(true)
        setTimeout(() => {
          setFadeIn(false)
        }, 400)
      }, 50)
    }, 400)
  }

  const handleShowTOC = () => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setFadeOut(true)
    setTimeout(() => {
      setShowTOC(true)
      setTimeout(() => {
        setFadeOut(false)
        setIsTransitioning(false)
      }, 50)
    }, 400)
  }

  const handleSelectExhibit = (index: number) => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setFadeOut(true)
    setTimeout(() => {
      setShowTOC(false)
      setCurrentExhibit(index)
      setTimeout(() => {
        setFadeOut(false)
        setIsTransitioning(false)
      }, 50)
    }, 400)
  }

  const handleNext = () => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setFadeOut(true)
    setTimeout(() => {
      setCurrentExhibit((prev) => (prev + 1) % exhibits.length)
      setTimeout(() => {
        setFadeOut(false)
        setIsTransitioning(false)
      }, 50) // Small delay to ensure DOM update before fade in
    }, 400)
  }

  const handlePrevious = () => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setFadeOut(true)
    setTimeout(() => {
      setCurrentExhibit((prev) => (prev - 1 + exhibits.length) % exhibits.length)
      setTimeout(() => {
        setFadeOut(false)
        setIsTransitioning(false)
      }, 50) // Small delay to ensure DOM update before fade in
    }, 400)
  }

  return (
    <>
      {showWelcome && (
        <div 
          className={`welcome-screen ${fadeOut ? 'fade-out' : ''} ${fadeIn ? 'fade-in' : ''}`}
        >
          <h1 className="title">the orbyl online art musuem</h1>
          <button 
            className="start-button"
            onClick={handleStart}
          >
            start
          </button>
        </div>
      )}
      
      {!showWelcome && (
        <ExhibitLayout 
          onGoHome={handleGoHome}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onShowTOC={handleShowTOC}
          showNext={!showTOC}
          showPrevious={!showTOC}
          previousIcon={!showTOC ? exhibitIcons[(currentExhibit - 1 + exhibits.length) % exhibits.length] : null}
          nextIcon={!showTOC ? exhibitIcons[(currentExhibit + 1) % exhibits.length] : null}
          fadeOut={fadeOut}
          fadeOutNav={fadeOutNav}
        >
          {showTOC ? (
            <TableOfContentsPage onSelectExhibit={handleSelectExhibit} />
          ) : (
            exhibits[currentExhibit]
          )}
        </ExhibitLayout>
      )}
    </>
  )
}

export default App
