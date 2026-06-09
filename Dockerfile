FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Custom nginx config for port 8080
COPY nginx.conf /etc/nginx/conf.d/

# Copy static site
COPY . /usr/share/nginx/html

# Remove non-web files from the image
RUN rm -f /usr/share/nginx/html/Dockerfile \
          /usr/share/nginx/html/nginx.conf \
          /usr/share/nginx/html/serve.py \
          /usr/share/nginx/html/Launch.bat

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
