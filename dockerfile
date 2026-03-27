FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

ENV TZ=Asia/Shanghai \
    PATH=/opt/conda/bin:/usr/local/cuda/bin:${PATH} \
    LD_LIBRARY_PATH=/usr/local/cuda/lib64:/usr/lib/x86_64-linux-gnu \
    CUDA_HOME=/usr/local/cuda \
    BUILDAH_ISOLATION=chroot \
    STORAGE_DRIVER=vfs \
    REFRESH_DATE=2026-03-08

# 配置Ubuntu镜像源（使用HTTP避免证书问题）并安装基础工具
RUN sed -i 's|http://archive.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list \
    && sed -i 's|http://security.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list \
    && rm -f /etc/apt/sources.list.d/*.list \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
       vim wget net-tools iputils-ping telnet curl git unzip pciutils \
       podman crun slirp4netns fuse-overlayfs uidmap openssh-server \
       ca-certificates libglib2.0-0 libxext6 libsm6 libxrender1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# 配置Podman环境变量和别名
RUN echo "export BUILDAH_ISOLATION=chroot" >> /etc/bash.bashrc \
    && echo "alias docker=podman" >> /etc/bash.bashrc

# 配置 Podman 使用 host 网络，禁用 CNI
RUN mkdir -p /etc/containers /var/lib/containers/storage /run/containers/storage \
    && chmod 755 /var/lib/containers /run/containers \
    && printf '%s\n' \
       '[engine]' \
       'runtime = "crun"' \
       'cgroup_manager = "cgroupfs"' \
       'events_logger = "file"' \
       '' \
       '[containers]' \
       'cgroups = "disabled"' \
       'netns = "host"' \
    > /etc/containers/containers.conf

# 配置存储使用 vfs（避免 fuse 在容器内的问题）
RUN printf '%s\n' \
    '[storage]' \
    'driver = "vfs"' \
    'runroot = "/var/run/containers/storage"' \
    'graphroot = "/var/lib/containers/storage"' \
    'rootless_storage_path = "/var/lib/containers/storage"' \
    '' \
    '[storage.options]' \
    > /etc/containers/storage.conf

# 配置Podman镜像仓库
RUN printf '%s\n' \
    'unqualified-search-registries = ["docker.io"]' \
    '' \
    '[[registry]]' \
    'prefix = "docker.io"' \
    'location = "docker.1ms.run"' \
    'insecure = false' \
    '' \
    '[[registry]]' \
    'prefix = "10.238.14.170:31104"' \
    'location = "10.238.14.170:31104"' \
    'insecure = true' \
    > /etc/containers/registries.conf

# 安装Miniconda
RUN wget -q --no-check-certificate \
    https://mirrors.tuna.tsinghua.edu.cn/anaconda/miniconda/Miniconda3-py312_25.5.1-0-Linux-x86_64.sh \
    && bash Miniconda3-py312_25.5.1-0-Linux-x86_64.sh -u -b -p /opt/conda \
    && rm -f Miniconda3-py312_25.5.1-0-Linux-x86_64.sh

# 配置Conda和Pip镜像源
RUN conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/free/ \
    && conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main/ \
    && conda config --set show_channel_urls yes \
    && pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple \
    && pip config set global.trusted-host pypi.tuna.tsinghua.edu.cn

# 初始化Conda并接受条款
RUN conda init bash \
    && conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main \
    && conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r

# 安装Jupyter相关组件并清理
RUN conda install -y jupyterlab notebook jupyterhub \
    && conda clean --all -f -y \
    && rm -rf /root/.cache/pip /tmp/* /var/tmp/*

# 创建Jupyter环境软链接
RUN mkdir -p /opt/conda/envs/jupyter/bin/ \
    && ln -sf /opt/conda/bin/jupyter-labhub /opt/conda/envs/jupyter/bin/jupyter-labhub

# 解决check_xsrf频繁报错的问题
RUN jupyter server --generate-config && echo "c.ServerApp.disable_check_xsrf = True" > ~/.jupyter/jupyter_server_config.py

# 安装一些coding中debug的插件
RUN pip install basedpyright && \
    pip install jupyterlab-lsp python-lsp-server[all] && \
    pip install black isort jupyterlab-code-formatter && \
    pip install jupyterlab-git jupyterlab-spreadsheet jupyterlab-data-explorer

# 安装自定义jupyter_server版本
RUN wget -q https://gitee.com/eric114/jupyter_server/releases/download/2.18.0.dev0-py3/jupyter_server-2.18.0.dev0-py3-none-any.whl \
    && pip install --no-cache-dir --force-reinstall jupyter_server-2.18.0.dev0-py3-none-any.whl \
    && rm -f jupyter_server-2.18.0.dev0-py3-none-any.whl \
    && rm -rf /root/.cache/pip

# 安装Node.js和构建工具（用于构建前端labextension）
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
       nodejs npm \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# ========== 安装 AI 辅助编程扩展 ==========
# 复制预构建的 wheel 文件到容器（wheel 已包含 labextension）
COPY dist/*.whl /tmp/

# 安装 wheel 包（pip install 会自动安装 labextension 到正确位置）
RUN pip install --no-cache-dir /tmp/*.whl && \
    jupyter server extension enable jupyterlab_llm_assistant --sys-prefix && \
    rm -rf /tmp/*.whl

# 创建工作目录
RUN mkdir -p /opt/ml/code

WORKDIR /opt/ml/code

CMD ["/bin/bash"]
