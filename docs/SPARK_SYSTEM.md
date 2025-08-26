# Spark System Documentation

## Overview

Spark is a comprehensive viral LinkedIn content detection and analysis system that combines Apify web scraping, Supabase database storage, and Next.js real-time display capabilities. The system automatically discovers, scores, and presents viral LinkedIn posts with advanced filtering and real-time updates.

## Architecture

### Components

1. **Apify Integration** (`/lib/services/apifyService.js`)
   - Uses `apimaestro/linkedin-posts-search-scraper-no-cookies` actor
   - Scrapes LinkedIn posts based on keywords and engagement metrics
   - Configured for optimal viral content detection

2. **Database Schema** (`/lib/table-definitions/`)
   - `viral_posts.sql`: Main table for storing scraped posts
   - `viral_posts_functions.sql`: Viral scoring algorithms and database functions
   - Indexes optimized for real-time queries and viral score calculations

3. **API Routes** (`/app/api/spark/`)
   - `/api/spark/scrape`: Triggers scraping jobs and handles Apify integration
   - `/api/spark/posts`: Retrieves filtered viral posts with pagination

4. **Frontend Components** (`/components/spark/`)
   - `RealtimeViralPosts.js`: Real-time post display with Supabase subscriptions
   - `SparkFilters.js`: Advanced filtering interface
   - `SparkStats.js`: Analytics and metrics dashboard

5. **Main Page** (`/app/spark/page.js`)
   - Tabbed interface for posts, analytics, and controls
   - Integrated filtering and real-time updates

## Features

### Viral Detection Algorithm

The system uses a sophisticated viral scoring algorithm that considers:
- **Engagement velocity**: Likes, comments, shares per hour since publication
- **Logarithmic scaling**: Normalizes scores across different post types
- **Real-time updates**: Automatic recalculation when engagement changes
- **Viral threshold**: Automatic flagging of truly viral content

### Real-time Capabilities

- **Live updates**: Supabase real-time subscriptions for instant post updates
- **Connection status**: Visual indicators for real-time connection health
- **Automatic refresh**: Posts update automatically when new viral content is detected

### Advanced Filtering

- **Time-based filtering**: Last 24 hours, week, month, or all time
- **Viral score thresholds**: Minimum viral score requirements
- **Keyword filtering**: Multi-keyword search with tag management
- **Engagement sorting**: Multiple sorting options (viral score, engagement rate, etc.)
- **Viral-only mode**: Show only posts marked as viral

### Automated Scraping

- **Scheduled runs**: Every 6 hours via Vercel cron jobs
- **Manual triggers**: On-demand scraping through the interface
- **Smart deduplication**: Handles duplicate posts automatically
- **Error handling**: Robust error handling with detailed logging

## Configuration

### Environment Variables

Required environment variables:

```bash
# Apify Configuration
APIFY_API_TOKEN=your_apify_token_here

# Supabase Configuration (already configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Setup

1. Run the table creation scripts:
   ```sql
   -- Create the main table
   \i lib/table-definitions/viral_posts.sql
   
   -- Create scoring functions
   \i lib/table-definitions/viral_posts_functions.sql
   ```

2. Enable real-time replication:
   - Go to Supabase Dashboard > Database > Replication
   - Enable replication for the `viral_posts` table

### Apify Actor Configuration

Default configuration for optimal viral detection:
```javascript
{
  keyword: "AI, machine learning, data science, generative AI, startup, product management, leadership",
  sort_type: "date_posted",
  date_filter: "past-6h",
  total_posts: 300
}
```

## Usage

### Accessing Spark

Navigate to `/spark` in your application to access the Spark dashboard.

### Manual Scraping

1. Go to the "Controls" tab
2. Click "Run Scraping Job Now"
3. Monitor progress and results in real-time

### Filtering Content

1. Use the "Filters & Controls" section to customize what you see
2. Adjust time ranges, viral score thresholds, and keywords
3. Enable "Only Viral Posts" for the highest-quality content

### Real-time Monitoring

- Posts update automatically as new viral content is detected
- Connection status indicator shows real-time subscription health
- Manual refresh button available for forced updates

## API Reference

### POST /api/spark/scrape

Triggers a new scraping job.

**Request Body:**
```json
{
  "input": {
    "keyword": "AI, machine learning",
    "sort_type": "date_posted",
    "date_filter": "past-24h",
    "total_posts": 500
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully scraped and stored 150 posts",
  "processed": 150,
  "upserted": 145
}
```

### GET /api/spark/posts

Retrieves viral posts with filtering.

**Query Parameters:**
- `limit`: Number of posts to return (default: 20)
- `offset`: Pagination offset (default: 0)
- `sortBy`: Sort field (viral_score, engagement_rate, published_at, etc.)
- `timeframe`: Time range (day, week, month, all)
- `minViralScore`: Minimum viral score threshold
- `keywords`: Comma-separated keywords
- `onlyViral`: Show only viral posts (true/false)

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalCount": 200,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

## Viral Scoring Explained

### Algorithm

The viral score is calculated using the formula:
```
engagement_score = (likes × 1) + (comments × 2) + (shares × 3) + (reactions × 1)
viral_score = log(1 + engagement_score / hours_since_published) × 10
```

### Score Interpretation

- **0-25**: Normal engagement
- **25-50**: Above average engagement
- **50-100**: High viral potential
- **100+**: Truly viral content

### Engagement Rate

Calculated as total engagement per hour since publication, capped at 9999.99%.

## Monitoring and Maintenance

### Health Checks

- Monitor the `/api/spark/scrape` GET endpoint for system status
- Check Supabase logs for database performance
- Monitor Apify usage and rate limits

### Performance Optimization

- Viral scores are automatically updated when engagement changes
- Database indexes optimize for common query patterns
- Real-time subscriptions minimize API calls

### Troubleshooting

1. **No posts appearing**: Check Apify token and rate limits
2. **Real-time not working**: Verify Supabase replication settings
3. **Slow queries**: Check database indexes and viral score calculations
4. **Scraping failures**: Review Apify actor logs and error messages

## Future Enhancements

### Planned Features

- **Advanced Analytics**: Trend analysis and prediction
- **Custom Keywords**: User-defined keyword sets
- **Export Capabilities**: CSV/JSON export of viral posts
- **Notification System**: Alerts for high-viral content
- **Multi-platform Support**: Twitter, Instagram integration

### Scaling Considerations

- **Rate Limiting**: Implement API rate limiting for high-traffic scenarios
- **Caching**: Add Redis caching for frequently accessed data
- **Batch Processing**: Optimize bulk viral score calculations
- **Load Balancing**: Distribute scraping jobs across multiple workers

## Support

For technical support or feature requests, refer to the main application documentation or contact the development team.
