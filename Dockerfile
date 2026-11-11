FROM php:8.2-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends libonig-dev libsqlite3-dev ca-certificates \
    && docker-php-ext-install mbstring pdo_sqlite pdo_mysql \
    && rm -rf /var/lib/apt/lists/* \
    && sed -i 's/^Listen 80$/Listen 10000/' /etc/apache2/ports.conf \
    && sed -i 's/<VirtualHost \*:80>/<VirtualHost *:10000>/' /etc/apache2/sites-available/000-default.conf \
    && sed -i 's/^DirectoryIndex .*/DirectoryIndex index.php index.html/' /etc/apache2/mods-available/dir.conf \
    && printf 'display_errors=Off\nlog_errors=On\nerror_log=/dev/stderr\nupload_max_filesize=12M\npost_max_size=16M\nmemory_limit=256M\nexpose_php=Off\n' > /usr/local/etc/php/conf.d/kips.ini \
    && mkdir -p /var/data \
    && chown www-data:www-data /var/data

ENV PORT=10000
ENV KIPS_DATA_DIR=/var/data

WORKDIR /var/www/html
COPY . /var/www/html

EXPOSE 10000
CMD ["bash", "-lc", "chown www-data:www-data /var/data && exec apache2-foreground"]
