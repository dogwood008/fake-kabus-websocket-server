import psycopg2
import csv
from datetime import date
import os
import sys
import zipfile


def extract_data(date: str, cur: psycopg2.extensions.cursor) -> list:
    table_name = 'stock_9983_raw'

    # Query to select newly created records
    query = f"SELECT * FROM {table_name} WHERE datetime::date = '{date}'"

    # Execute the query
    cur.execute(query)

    # Fetch all the records
    records = cur.fetchall()
    return records

def output_csv(path_to_csv_file: str = 'export.csv', records: list = []):
    # Write the records to the CSV file
    with open(path_to_csv_file, mode='w', newline='') as file:
        writer = csv.writer(file)
        writer.writerows(records)

def open_db() -> tuple:
    # Connect to the PostgreSQL database
    conn = psycopg2.connect(
        host=os.environ.get('POSTGRES_HOST'),
        database=os.environ.get('POSTGRES_DB_NAME'),
        user=os.environ.get('POSTGRES_USER'),
        password=os.environ.get('POSTGRES_PASSWORD'),
    )

    # Create a cursor object
    cur = conn.cursor()
    return cur, conn

def close_db(cur: psycopg2.extensions.cursor, conn: psycopg2.extensions.connection):
    # Close the cursor and connection
    cur.close()
    conn.close()

def zip_csv(path_to_csv_file: str):
    # Zip the CSV file
    Z_BEST_COMPRESSION = 9
    path_to_zip_file = f'{path_to_csv_file}.zip'
    zip_options = {
        'compression': zipfile.ZIP_DEFLATED,
        'compresslevel': Z_BEST_COMPRESSION,
    }

    with zipfile.ZipFile(path_to_zip_file, 'w', **zip_options) as zipf:
        print(f'path_to_zipfile: {path_to_zip_file}')
        zipf.write(path_to_csv_file, os.path.basename(path_to_csv_file))


def main():
    cur, conn = open_db()
    # Get today's date
    # Get the first argument from the command line arguments
    print(f'argv: {sys.argv}')
    arg = sys.argv[1]
    print(f'arg: {arg}')

    # Convert the argument to a date object
    today = arg or date.today()
    print('export start')
    print(f'today: {today}')

    records = extract_data(today, cur)
    path_to_csv_file = f'export_{today}.csv'
    print(f'path_to_csv_file: {path_to_csv_file}')
    output_csv(path_to_csv_file=path_to_csv_file, records=records)
    zip_csv(path_to_csv_file)

    close_db(cur, conn)

    print('export done')


main()
