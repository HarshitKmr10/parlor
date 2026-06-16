import React from 'react';

function useOutsideAlerter(ref: any, setX: any): void {
  React.useEffect(() => {
    /**
     * Alert if clicked on outside of element
     */
    function handleClickOutside(event: any) {
      if (ref.current && !ref.current.contains(event.target)) {
        setX(false);
      }
    }
    // Bind the event listener
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, setX]);
}

function Dropdown(props: {
  button: JSX.Element;
  children: JSX.Element;
  classNames: string;
  animation?: string;
}) {
  const {
    button, children, classNames, animation,
  } = props;
  const wrapperRef = React.useRef(null);
  const [openWrapper, setOpenWrapper] = React.useState(false);
  useOutsideAlerter(wrapperRef, setOpenWrapper);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      setOpenWrapper(!openWrapper);
    }
  };

  return (
    <div ref={wrapperRef} className="relative flex">
      <div
        className="flex"
        role="button"
        tabIndex={0}
        onMouseDown={() => setOpenWrapper(!openWrapper)}
        onKeyDown={handleKeyDown}
        aria-expanded={openWrapper}
      >
        {button}
      </div>
      <div
        className={`${classNames} absolute z-10 ${
          animation
          || 'origin-top-right transition-all duration-300 ease-in-out'
        } ${openWrapper ? 'scale-100' : 'scale-0'}`}
      >
        {children}
      </div>
    </div>
  );
}

export default Dropdown;
