'use client';

import { Doughnut, Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title
);

// Doughnut chart for engagement breakdown
export function EngagementBreakdownChart({ likes, comments, shares, className = "" }) {
  const data = {
    labels: ['Likes', 'Comments', 'Shares'],
    datasets: [
      {
        data: [likes, comments, shares],
        backgroundColor: [
          '#EF4444', // red-500
          '#3B82F6', // blue-500
          '#10B981', // green-500
        ],
        borderColor: [
          '#DC2626', // red-600
          '#2563EB', // blue-600
          '#059669', // green-600
        ],
        borderWidth: 2,
        hoverOffset: 4
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((context.raw / total) * 100).toFixed(1);
            return `${context.label}: ${context.raw.toLocaleString()} (${percentage}%)`;
          }
        }
      }
    }
  };

  return (
    <div className={`h-64 ${className}`}>
      <Doughnut data={data} options={options} />
    </div>
  );
}

// Line chart for trend analysis
export function TrendChart({ trendData, className = "" }) {
  const data = {
    labels: trendData.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Viral Score',
        data: trendData.map(d => d.viralScore),
        borderColor: '#8B5CF6', // purple-500
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#8B5CF6',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      },
      {
        label: 'Post Count',
        data: trendData.map(d => d.posts),
        borderColor: '#3B82F6', // blue-500
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#3B82F6',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        yAxisID: 'y1'
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#374151',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        border: {
          display: false
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Viral Score'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        border: {
          display: false
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Post Count'
        },
        grid: {
          drawOnChartArea: false,
        },
        border: {
          display: false
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  return (
    <div className={`h-80 ${className}`}>
      <Line data={data} options={options} />
    </div>
  );
}

// Bar chart for topic performance
export function TopicPerformanceChart({ topics, className = "" }) {
  const data = {
    labels: topics.slice(0, 10).map(t => t.name.length > 15 ? t.name.substring(0, 15) + '...' : t.name),
    datasets: [
      {
        label: 'Viral Score',
        data: topics.slice(0, 10).map(t => t.viralScore),
        backgroundColor: 'rgba(139, 92, 246, 0.8)', // purple-500
        borderColor: '#8B5CF6',
        borderWidth: 2,
        borderRadius: 4,
        borderSkipped: false
      },
      {
        label: 'Post Count',
        data: topics.slice(0, 10).map(t => t.postCount),
        backgroundColor: 'rgba(59, 130, 246, 0.8)', // blue-500
        borderColor: '#3B82F6',
        borderWidth: 2,
        borderRadius: 4,
        borderSkipped: false,
        yAxisID: 'y1'
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          pointStyle: 'rect',
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#374151',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        border: {
          display: false
        },
        ticks: {
          maxRotation: 45,
          minRotation: 0
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Viral Score'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        border: {
          display: false
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Post Count'
        },
        grid: {
          drawOnChartArea: false,
        },
        border: {
          display: false
        }
      }
    }
  };

  return (
    <div className={`h-80 ${className}`}>
      <Bar data={data} options={options} />
    </div>
  );
}

// Radar chart for influencer comparison
export function InfluencerRadarChart({ influencers, className = "" }) {
  const { Radar } = require('react-chartjs-2');
  const { RadialLinearScale } = require('chart.js');
  
  // Register the RadialLinearScale for radar charts
  ChartJS.register(RadialLinearScale);

  const metrics = ['Posts', 'Viral Posts', 'Avg Engagement', 'Consistency', 'Reach'];
  
  const datasets = influencers.slice(0, 3).map((influencer, index) => {
    const colors = [
      { bg: 'rgba(239, 68, 68, 0.2)', border: '#EF4444' },  // red
      { bg: 'rgba(59, 130, 246, 0.2)', border: '#3B82F6' }, // blue
      { bg: 'rgba(16, 185, 129, 0.2)', border: '#10B981' }  // green
    ];
    
    // Normalize metrics to 0-100 scale
    const maxPosts = Math.max(...influencers.map(i => i.posts));
    const maxViralPosts = Math.max(...influencers.map(i => i.viralPosts));
    const maxEngagement = Math.max(...influencers.map(i => i.totalEngagement));
    
    return {
      label: influencer.name,
      data: [
        (influencer.posts / maxPosts) * 100,
        (influencer.viralPosts / maxViralPosts) * 100,
        (influencer.totalEngagement / maxEngagement) * 100,
        influencer.viralPosts > 0 ? (influencer.viralPosts / influencer.posts) * 100 : 0, // Viral rate
        Math.min((influencer.totalEngagement / influencer.posts) / 100, 100) // Avg engagement per post
      ],
      backgroundColor: colors[index].bg,
      borderColor: colors[index].border,
      borderWidth: 2,
      pointBackgroundColor: colors[index].border,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2
    };
  });

  const data = {
    labels: metrics,
    datasets
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20
        }
      }
    },
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        angleLines: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        pointLabels: {
          font: {
            size: 12
          }
        }
      }
    }
  };

  return (
    <div className={`h-80 ${className}`}>
      <Radar data={data} options={options} />
    </div>
  );
}
