# See here for image contents: https://github.com/microsoft/vscode-dev-containers/tree/v0.245.2/containers/ubuntu/.devcontainer/base.Dockerfile

# [Choice] Ubuntu version (use ubuntu-22.04 or ubuntu-18.04 on local arm64/Apple Silicon): ubuntu-22.04, ubuntu-20.04, ubuntu-18.04
ARG VARIANT="jammy"
FROM mcr.microsoft.com/vscode/devcontainers/base:0-${VARIANT}


# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>

COPY .bashrc .bashrc
COPY .bash_profile .bash_profile

RUN apt update && \
  apt install -y vim postgresql direnv git && \
  direnv allow && \
  git clone https://github.com/nodenv/nodenv.git ~/.nodenv && \
  cd ~/.nodenv && src/configure && make -C src && \
  ~/.nodenv/bin/nodenv init && \
  source ~/.bash_profile && \
  curl -fsSL https://github.com/nodenv/nodenv-installer/raw/master/bin/nodenv-doctor | bash && \
  mkdir -p "$(nodenv root)"/plugins && \
  git clone https://github.com/nodenv/node-build.git "$(nodenv root)"/plugins/node-build && \
  nodenv install 16.17.0