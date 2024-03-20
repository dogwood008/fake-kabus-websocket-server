FROM python:3.12.2-bookworm

ARG WORKDIR=/app
WORKDIR $WORKDIR
COPY ./requirement.txt ${WORKDIR}/requirement.txt
RUN pip install -r requirement.txt

ENTRYPOINT ["python", "./csv_export.py"]
CMD ""