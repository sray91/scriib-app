import { useEffect, useRef, useState } from 'react';

export const TwitterEmbed = ({ tweetId }) => {
  const containerRef = useRef(null);
  const [height, setHeight] = useState('auto');
  const scale = 0.8; // Adjust this value to make tweets smaller or larger

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    
    // After the Twitter widget loads, adjust the container height
    script.onload = () => {
      if (window.twttr) {
        window.twttr.widgets.load();
        
        // Give some time for the tweet to render
        setTimeout(() => {
          if (containerRef.current) {
            const tweetElement = containerRef.current.querySelector('.twitter-tweet');
            if (tweetElement) {
              // Get the height of the rendered tweet and apply the scale
              const actualHeight = tweetElement.offsetHeight * scale;
              setHeight(`${actualHeight}px`);
            }
          }
        }, 500);
      }
    };
    
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [tweetId, scale]);

  const wrapperStyle = {
    width: '100%',
    height,
    overflow: 'hidden',
    marginBottom: '1rem',
  };

  const embedStyle = {
    transform: `scale(${scale})`,
    transformOrigin: '0 0',
    width: `${100 / scale}%`, // Compensate for the scale
  };

  return (
    <div style={wrapperStyle} ref={containerRef}>
      <div style={embedStyle}>
        <blockquote 
          className="twitter-tweet" 
          data-dnt="true" 
          data-theme="light"
          data-width="550"
        >
          <a href={`https://twitter.com/x/status/${tweetId}`}></a>
        </blockquote>
      </div>
    </div>
  );
}; 