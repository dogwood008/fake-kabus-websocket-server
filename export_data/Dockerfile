FROM python:3.12.2-bookworm

ARG WORKDIR=/app
ARG TMPDIR=/tmp

WORKDIR ${TMPDIR}
COPY ./requirement.txt ${TMPDIR}/requirement.txt
RUN pip install -r requirement.txt

WORKDIR ${WORKDIR}
COPY ./csv_export.py ${WORKDIR}/csv_export.py
ENTRYPOINT ["python", "./csv_export.py"]