-- Create a helper function to get table column information

CREATE OR REPLACE FUNCTION public.get_table_columns(table_name text)
RETURNS TABLE (
    column_name text,
    data_type text,
    is_nullable boolean,
    column_default text,
    character_maximum_length integer
) LANGUAGE SQL SECURITY DEFINER AS $$
    SELECT 
        column_name::text,
        data_type::text,
        (is_nullable = 'YES')::boolean as is_nullable,
        column_default::text,
        character_maximum_length
    FROM 
        information_schema.columns
    WHERE 
        table_name = $1
        AND table_schema = 'public'
    ORDER BY 
        ordinal_position;
$$; 