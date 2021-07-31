FROM python:alpine3.9

RUN apk --update add make vim git

RUN mkdir -p /usr/src/docs
WORKDIR /usr/src/docs

RUN pip install --upgrade pip

COPY docs /usr/src/docs

RUN pip install -r requirements.txt
