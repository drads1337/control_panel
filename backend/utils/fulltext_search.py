"""
Full-text search utilities using PostgreSQL tsvector

This module provides efficient full-text search capabilities using PostgreSQL's
tsvector and tsquery features, replacing inefficient ILIKE queries with wildcards.
"""

from sqlalchemy import text
from sqlalchemy.orm import Query


def to_tsquery(search_term: str) -> str:
    """
    Convert a search term to PostgreSQL tsquery format.
    
    Args:
        search_term: The search term to convert
        
    Returns:
        A tsquery string suitable for PostgreSQL full-text search
    """
    if not search_term:
        return ""
    
    # Escape special characters and split into words
    # Replace special tsquery characters: & | ! ( ) : '
    escaped = search_term.replace("'", "''").replace("\\", "\\\\")
    
    # Split into words and join with & (AND operator)
    # This allows searching for all words in the query
    words = escaped.split()
    if not words:
        return ""
    
    # Join words with & (AND) operator
    # Each word is automatically stemmed by PostgreSQL
    return " & ".join(f"{word}:*" for word in words if word)


def fulltext_search_filter(query: Query, search_term: str, tsvector_column_name: str = "search_vector"):
    """
    Apply full-text search filter to a query using tsvector column.
    
    SECURITY: This function uses parameterized queries to prevent SQL injection.
    - search_term is sanitized and passed as a parameter
    - tsvector_column_name should be a trusted constant (not user input)
    - Column name is validated to contain only alphanumeric characters and underscores
    
    Args:
        query: SQLAlchemy query object
        search_term: The search term to filter by (user input - will be sanitized)
        tsvector_column_name: Name of the tsvector column (default: 'search_vector')
                             WARNING: Should be a trusted constant, not user input
        
    Returns:
        Filtered query
    """
    if not search_term or not search_term.strip():
        return query
    
    # SECURITY: Validate column name to prevent SQL injection
    # Only allow alphanumeric characters and underscores (standard identifier pattern)
    import re
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', tsvector_column_name):
        raise ValueError(f"Invalid column name: {tsvector_column_name}. Only alphanumeric characters and underscores are allowed.")
    
    # Convert search term to tsquery format (sanitizes user input)
    tsquery = to_tsquery(search_term)
    if not tsquery:
        return query
    
    # SECURITY: Use parameterized query - tsquery is passed as parameter, not concatenated
    # Column name is validated above and is a trusted constant
    # Use @@ operator for full-text search with tsvector
    # This is much more efficient than ILIKE with wildcards
    # The tsvector column is indexed with GIN index for fast searches
    return query.filter(text(f"{tsvector_column_name} @@ to_tsquery('simple', :tsquery)")).params(tsquery=tsquery)

