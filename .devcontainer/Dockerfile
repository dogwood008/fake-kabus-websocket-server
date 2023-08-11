# See here for image contents: https://github.com/microsoft/vscode-dev-containers/tree/v0.245.2/containers/ubuntu/.devcontainer/base.Dockerfile

# [Choice] Ubuntu version (use ubuntu-22.04 or ubuntu-18.04 on local arm64/Apple Silicon): ubuntu-22.04, ubuntu-20.04, ubuntu-18.04
ARG VARIANT="jammy"
FROM mcr.microsoft.com/vscode/devcontainers/base:0-${VARIANT}


# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>

COPY .bash_profile .bash_profile

RUN apt update && \
  apt install -y vim postgresql direnv git build-essential

USER vscode
RUN git clone https://github.com/nodenv/nodenv.git ~/.nodenv && \
  cd ~/.nodenv && src/configure && make -C src
ENV PATH /home/vscode/.nodenv/bin:${PATH}
RUN eval "$(nodenv init -)" && \
  mkdir -p "$(nodenv root)"/plugins && \
  git clone https://github.com/nodenv/node-build.git "$(nodenv root)"/plugins/node-build && \
  nodenv install 16.17.0

COPY .bashrc.sample .bashrc