FROM php:8.2-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends libonig-dev \
    && docker-php-ext-install mbstring pdo_sqlite \
    && rm -rf /var/lib/apt/lists/* \
    && sed -i 's/^Listen 80$/Listen 10000/' /etc/apache2/ports.conf \
    && sed -i 's/<VirtualHost \*:80>/<VirtualHost *:10000>/' /etc/apache2/sites-available/000-default.conf \
    && mkdir -p /var/data \
    && chown www-data:www-data /var/data

ENV PORT=10000
ENV KIPS_DATA_DIR=/var/data

WORKDIR /var/www/html
COPY . /var/www/html

EXPOSE 10000
CMD ["bash", "-lc", "chown www-data:www-data /var/data && exec apache2-foreground"]
