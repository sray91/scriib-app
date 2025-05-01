import { useEffect, useRef, useState } from 'react';

export const TwitterEmbed = ({ tweetId }) => {
  const containerRef = useRef(null);
  const [height, setHeight] = useState('auto');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const scale = 0.8; // Adjust this value to make tweets smaller or larger

  useEffect(() => {
    // Reset state on tweetId change
    setLoading(true);
    setError(false);
    
    let scriptElement = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]');
    let isMounted = true;
    
    const loadTweet = () => {
      if (!isMounted) return;
      
      if (window.twttr) {
        try {
          window.twttr.widgets.load(containerRef.current);
          
          // Give some time for the tweet to render
          const timeout = setTimeout(() => {
            if (!isMounted) return;
            
            if (containerRef.current) {
              const tweetElement = containerRef.current.querySelector('.twitter-tweet');
              if (tweetElement) {
                // Get the height of the rendered tweet and apply the scale
                const actualHeight = tweetElement.offsetHeight * scale;
                setHeight(`${actualHeight}px`);
                setLoading(false);
              } else {
                // No tweet found after timeout
                setError(true);
                setLoading(false);
              }
            }
          }, 3000); // Increased timeout to allow more time for loading
          
          return () => clearTimeout(timeout);
        } catch (err) {
          console.error('Error loading tweet:', err);
          setError(true);
          setLoading(false);
        }
      }
    };
    
    // If script already exists, just load the tweet
    if (scriptElement) {
      loadTweet();
    } else {
      // Otherwise create and load the script
      scriptElement = document.createElement('script');
      scriptElement.src = 'https://platform.twitter.com/widgets.js';
      scriptElement.async = true;
      scriptElement.id = 'twitter-widget-js';
      
      scriptElement.onload = loadTweet;
      
      scriptElement.onerror = () => {
        if (!isMounted) return;
        console.error('Failed to load Twitter widgets script');
        setError(true);
        setLoading(false);
      };
      
      document.body.appendChild(scriptElement);
    }

    return () => {
      isMounted = false;
      // Don't remove the script on unmount as it can be used by other tweet embeds
    };
  }, [tweetId, scale]);

  const wrapperStyle = {
    width: '100%',
    height: loading ? '250px' : height, // Provide default height while loading
    overflow: 'hidden',
    marginBottom: '1rem',
    position: 'relative',
  };

  const embedStyle = {
    transform: `scale(${scale})`,
    transformOrigin: '0 0',
    width: `${100 / scale}%`, // Compensate for the scale
  };

  return (
    <div style={wrapperStyle} ref={containerRef}>
      {loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8f9fa',
          borderRadius: '0.5rem',
        }}>
          <span>Loading tweet...</span>
        </div>
      )}
      
      {error && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8f9fa',
          borderRadius: '0.5rem',
          flexDirection: 'column',
          padding: '1rem',
        }}>
          <span style={{color: '#e74c3c', marginBottom: '0.5rem'}}>Failed to load tweet</span>
          <a 
            href={`https://twitter.com/x/status/${tweetId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{color: '#3498db'}}
          >
            View on X/Twitter
          </a>
        </div>
      )}
      
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